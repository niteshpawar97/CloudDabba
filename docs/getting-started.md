# Getting Started

CloudDabba runs on any Ubuntu 22.04+ or Debian 12+ VPS. One command installs everything — Docker, NGINX, PM2, Postgres, Redis, MariaDB, certbot — and starts the platform.

## One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/niteshpawar97/CloudDabba/master/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

The installer prompts for a domain (press Enter for IP-only install) and an admin email, then runs ~13 steps with a live progress bar. At the end you get a panel URL — open it in a browser and finish first-time setup via the wizard.

## System requirements

- Ubuntu 22.04+ or Debian 12+
- 2 GB RAM minimum (4 GB recommended)
- 20 GB disk minimum
- Root access (or a sudo user with NOPASSWD)

## Ports to open

Open the following on both your host firewall (UFW) and your cloud provider firewall (AWS Security Group, Oracle Security List, GCP Firewall, etc):

| Port | Purpose |
|------|---------|
| 80 | HTTP (Let's Encrypt + NGINX) |
| 443 | HTTPS |
| 6050 | CloudDabba panel (direct access before SSL is up) |
| 10000-20000 | Deployed app containers |

`install.sh` configures UFW for you, but cannot touch the cloud provider firewall — you'll see a reminder at the end of the install with the exact ports to open there.

## First-time setup wizard

After install, open the panel URL in your browser. The wizard runs in 4 steps:

1. Welcome
2. Domain & admin email (pre-filled from installer)
3. Admin password
4. Done — redirects to dashboard

Domain and email are locked because they were set during install. Only the admin password is collected here.
