site_name: {{SITE_NAME}}
docs_dir: docs
site_dir: html
theme:
  name: material
  palette:
    scheme: slate
  logo: assets/logo.png
  favicon: assets/logo.png
plugins:
  - search
markdown_extensions:
  - pymdownx.highlight
  - pymdownx.superfences
  - admonition
extra_css:
  - assets/extra.css
nav:
{{NAV}}
