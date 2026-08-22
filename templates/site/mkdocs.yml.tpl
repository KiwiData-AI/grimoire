site_name: {{SITE_NAME}}
docs_dir: docs
site_dir: html
use_directory_urls: false
theme:
  name: material
  palette:
    scheme: slate
  logo: assets/logo.png
  favicon: assets/logo.png
plugins:
  - offline
  - search
markdown_extensions:
  - pymdownx.highlight
  - pymdownx.superfences
  - admonition
extra_css:
  - assets/extra.css
nav:
{{NAV}}
