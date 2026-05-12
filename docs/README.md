# CloudDabba Documentation

Self-hosted PaaS for deploying GitHub repos as Docker containers with auto-generated subdomains, custom domains, and SSL.

This folder is the source for [clouddabba.dev/docs](https://clouddabba.dev/docs). For the most up-to-date version, browse it in the running panel — the in-app docs are versioned alongside the code.

## Contents

| Page | What's covered |
|------|----------------|
| [getting-started.md](./getting-started.md) | One-line install, system requirements, first-time setup |
| [scripts.md](./scripts.md) | `install.sh`, `update.sh`, `uninstall.sh` — flags, steps, safety |
| [deploying-apps.md](./deploying-apps.md) | Project types, env vars, subdirectory apps, auto-deploy |
| [docker-compose.md](./docker-compose.md) | Multi-service apps (ERPNext, Frappe, Strapi+DB) |
| [databases.md](./databases.md) | Per-project Postgres / MariaDB / Redis provisioning |
| [custom-domains.md](./custom-domains.md) | Custom domains, SSL, wildcard via Cloudflare |
| [platform-settings.md](./platform-settings.md) | Admin settings, diagnostics, restart, change domain |
| [troubleshooting.md](./troubleshooting.md) | Common errors and fixes |

## Quick install

```bash
curl -fsSL https://raw.githubusercontent.com/niteshpawar97/CloudDabba/master/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

Then open the panel URL printed at the end of the install and complete first-time setup in the browser wizard.
