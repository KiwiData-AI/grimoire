# Container & OS-Package Scan Triage Reference

The deep-dive for `os-package` / `container` / `iac` findings from image scanners (Trivy, Grype). Loaded by `grimoire-vuln-triage` when a scan carries container/OS-package results. The general rubric — normalize, reconcile, KEV/EPSS, VEX, urgency, Contrarian — lives in `./dependency-vuln-triage.md`; this file is the discipline for the part that goes wrong most: deciding what to *do* about a base-OS CVE.

Written after a review recommended removing `Mesa`, `ncurses`, and `krb5` from a headless Django API with the rationale "no business in a headless API." Two of the three could not be removed without breaking the image. This guide exists so that mistake is not repeated.

## Separate the two axes — they are not the same question

- **Reachability** — *is the vulnerable code path actually called by untrusted input in this service?* Decides **urgency** (hotfix / next-release / accept). A library present but never invoked is low risk even at CVSS CRITICAL.
- **Removability** — *can we delete the package, and what breaks if we do?* Decides **remediation** (Dockerfile edit / base bump / accept+document).

Conflating them produces the classic error: "this lib is unreachable, so remove it." Unreachable ≠ removable. A headless API genuinely cannot reach Mesa's OpenGL code — **and also cannot remove Mesa** if it arrived transitively behind a package it needs. Judge both, separately.

## Core rule: trace before you recommend

A CVE scanner reports *what is present*, not *why* or *whether it is removable*. Never recommend removing a package until you have answered all three:

1. **How does it get in?** Directly installed, transitive, base image, or builder-stage-only?
2. **What depends on it?** Application code, a required runtime lib, or the base OS?
3. **What breaks if it's gone?** Build, runtime, or nothing — and what's the test that proves it?

"This doesn't belong in a headless API" is an assumption, not an analysis.

## Step A — How is it installed?

Search the Dockerfile for an explicit install line first.

- **Explicitly installed** (named in `apt-get install` / `pip install`): a real removal candidate — continue to Step B.
- **Not named anywhere**: it's transitive — pulled by another package or shipped in the base image. You cannot `apt-get remove` it without breaking its parent. Identify the parent before saying anything.

Common transitive sources — map these before flagging:

| Flagged lib | Usually pulled in by | Notes |
|---|---|---|
| krb5 / libgssapi-krb5 | `libpq5`, `postgresql-client`, `curl` | Postgres GSSAPI/Kerberos auth |
| ncurses / libtinfo | base image | bash, apt, dpkg, python readline link it |
| Mesa / libgl1 / libgbm | `libgl1`, `libglib2.0-0` | OpenCV / docling / easyocr deps |
| OpenSSL / libssl | base image + most TLS clients | almost never removable |
| libexpat1 | base image + python (`pyexpat`) | stdlib XML |

## Step B — What actually depends on it?

Do not assume. Check the repo:

- **App imports** — grep for the consuming module (`import cv2`, `import magic`, `import pyodbc`, `gssapi`, `lxml`).
- **System tools used at runtime** — grep code, scripts, and the entrypoint for the binary (`psql`, `pg_dump`, `pg_isready`).
- **Driver bundling** — many Python wheels bundle their native lib, making the system package redundant. `psycopg-binary` bundles libpq → system `libpq5` not needed for the driver; `pylibmagic` bundles libmagic → system `libmagic1` may be redundant. When a binary wheel is present, the matching system runtime package is often dead weight — **verify, then say so**.
- **Cross-service config trap** — env vars or paths in this repo may configure a *different* container. `EASYOCR_MODULE_PATH` / `DOCLING_ARTIFACTS_PATH` in bake are passed by `job_runner.py` to the **ricky** pipeline container — they do **not** mean bake runs easyocr/docling. Never justify or condemn a package using a string that belongs to another service.

## Step C — Know what is not removable

Some findings are not actionable by editing an install line:

- **Base-image packages** (ncurses, OpenSSL, glibc, zlib, expat): part of the OS. Removing breaks bash/apt/dpkg or the Python runtime. The only real mitigations are: **switch to a smaller/distroless base**, **bump the base image** for patched versions, or **accept and document** the risk. State which — do not tell the user to "remove" it.
- **Transitive deps of required libs** (e.g. krb5 behind `libpq5`): removable only by also removing the parent, and only if the parent is itself unneeded.

## Step D — Multi-stage builds: target the right stage

In a multi-stage Dockerfile only the final stage ships. Packages in a `builder` stage (compilers, `-dev` headers) do **not** appear in the runtime image if only the artifact (`/opt/venv` or equivalent) is copied forward. They are not runtime attack surface. Don't flag builder-stage packages as runtime risk; if you mention them, label them **build-only**.

## Step E — Assess real risk, not just presence (reachability)

Maps to `./dependency-vuln-triage.md` § Reachability. A CVE in a library never reached by untrusted input is lower priority than its score. For each finding note:

- Is the vulnerable code path reachable in *this* service? (use the consumer map below — grep the **consumer**, not the C package name; the app never `import`s `libexpat1`)
- Network/user-input exposed, or internal-only?
- Headless API context: no display, no user shell, no interactive TTY → GUI/terminal libs (Mesa, ncurses) are usually unreachable even when present.

| OS package | Reached only if the app… | Grep for |
|---|---|---|
| libexpat1 | parses XML via stdlib | `xml.etree`, `xml.sax`, `pyexpat`, `minidom` |
| libxml2 / libxslt | parses XML/XSLT via lxml | `import lxml`, `etree`, `XSLT` |
| krb5 / libgssapi | does Kerberos/GSSAPI auth | `gssapi`, `kerberos`, `requests_kerberos` |
| mesa / libGL / libgbm | does GPU/OpenGL rendering | `OpenGL`, `moderngl`, `cv2` (headless API: none) |
| ncurses / libtinfo | drives an interactive terminal | `curses`, `pty`, `readline` (web process: none) |
| libssl / openssl | does TLS | usually reachable — judge on impact |
| imagemagick / libvips | processes user-uploaded images | the upload/convert path |

**Grep can lie — verify the binding.** `Price.fromstring()` (price-parser) is not `etree.fromstring()` (XML). Confirm the match is the real vulnerable call site before asserting `not_affected` or `affected`; if you can't, mark `under_investigation` and name what a human must check. Prefer reachability-based prioritization over raw CVSS.

## Honor the scanner's fix-state

Trivy `Status` (and Grype `fix.state`): `fixed` → a patched package exists; upgrade/rebuild is the lever. `affected` / `will_not_fix` / `end_of_life` → **no fix available**; the lever is *accept with expiry* or *rebuild on a newer/slimmer base when one ships* — **not** an "upgrade X" ticket. `under_investigation` → distro hasn't ruled; mirror it. Never file an upgrade task for a no-fixed-version finding.

## Output per flagged package

1. **Package + CVE(s)** — what the scanner said (and the dedup count if one CVE spans many packages).
2. **How it's installed** — explicit line N / transitive via `<parent>` / base image / builder-only.
3. **What depends on it** — app module / runtime tool / OS, with grep evidence.
4. **Reachable?** — vulnerable path called by untrusted input? (provenance: graph / grep / image-layer / unknown)
5. **Removable?** — Yes (safe) / Yes (after removing `<parent>`, test X) / No (base OS) / No (required by Y).
6. **Recommendation** — exact Dockerfile edit, or "patch/bump base image", or "accept + document", **plus the post-change test** (build, import, DB connect). Route image-structure changes to infra / `grimoire-draft`, not app remediation.

## Anti-patterns — do not do these

- ❌ "X has no business in a headless API" with no trace of how X got installed.
- ❌ Recommending `apt-get remove` of a base-image or transitive package.
- ❌ Treating scanner presence as equal to exploitable risk.
- ❌ Justifying or condemning a package using config that targets another service.
- ❌ Flagging builder-stage packages as runtime attack surface.
- ❌ Recommending removal without naming the post-change test.
- ❌ Filing an "upgrade" ticket for a `will_not_fix` / no-fixed-version finding.
