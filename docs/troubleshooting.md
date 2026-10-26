# Troubleshooting

## Permission denied on a script

```bash
chmod +x install.sh update.sh uninstall.sh
# or
sudo bash update.sh   # bash doesn't need the execute bit
```

## `git pull` conflict on install.sh

Once-only on clones made before `.gitattributes` was added:

```bash
git checkout install.sh
git pull
```

## 404 / wrong site on the base domain

Check `/etc/nginx/sites-enabled/` for stray configs from a previous host. CloudDabba's `nginx.conf` only includes `cd-*.conf` — anything else is leftover.

```bash
sudo ls /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/<stray-file>.conf
sudo nginx -t && sudo nginx -s reload
```

## SSL install fails with "Some challenges have failed"

Most common cause: port 80 not reachable from Let's Encrypt servers.

```bash
sudo tail -50 /var/log/letsencrypt/letsencrypt.log
curl -v http://yourdomain.com    # from your laptop, NOT the VPS
```

If `curl` times out from outside, port 80 is blocked in UFW or your cloud provider firewall.

## Deploy fails with EACCES on /tmp/clouddabba

Old root-owned tmp dir from a previous run as a different user:

```bash
sudo rm -rf /tmp/clouddabba
```

## SPA deep links return 404

Fixed in current builds — CloudDabba bakes `try_files $uri $uri/ /index.html;` into the SPA nginx template. Pull latest and redeploy.

## Browser still shows old site after switching domains

HSTS + cached HTML from previous hosting:

1. Chrome: `chrome://net-internals/#hsts` → Delete domain security policies → enter your domain → Delete
2. F12 → Application → Storage → Clear site data
3. Try incognito to confirm
4. Or test from a different device/network

## Custom domain works on HTTP but not HTTPS after redeploy

Fixed — CloudDabba now preserves SSL config across redeploys. Pull latest and redeploy.

## Container keeps restarting

```bash
docker logs <container-name>
docker ps -a --filter name=cd-
```

Usually the app crashes on startup. Check env vars are set correctly — especially `PORT`, `DATABASE_URL`, and any framework-specific secrets like `SESSION_SECRET`.

## Next.js build fails with "X must be at least 32 characters"

Build-time env vars not set. Add them in the deploy wizard or project page — CloudDabba now writes them to `.env`, `.env.local`, `.env.production`, and `.env.production.local` in the build context, so `next build` can read them.

## Deploy fails, or Smart Detection picks the wrong project type

Auto-detection is a best guess from repo structure — it can get it wrong for uncommon layouts, monorepos, or frameworks it doesn't recognize. The reliable fix for any project type: commit a `Dockerfile` to the repo root and select **Custom Dockerfile** in the deploy wizard (or leave the type as-is — a root `Dockerfile` is always used over the generated one). See [Custom Dockerfile](deploying-apps.md#custom-dockerfile-escape-hatch) for a minimal example and requirements.

The live build log (`/logs/:deploymentId`) also prints this tip automatically whenever a deployment fails.

## More help

Open an issue at https://github.com/niteshpawar97/CloudDabba/issues with:

- Output of `pm2 logs clouddabba-api --lines 50 --nostream`
- Output of `sudo nginx -T 2>/dev/null | head -100`
- What you were doing when the issue happened

## Disk filling up / automatic storage management

CloudDabba checks disk usage every 10 minutes (admin dashboard → **Docker Storage**):

| Usage | Action |
|-------|--------|
| ≥ 80% | Warning logged + shown in the dashboard |
| ≥ 90% | Cleanup: build cache older than 24h, dangling / old CloudDabba images |
| ≥ 95% | Emergency: all unused build cache and all unused images |

Never touched: running or stopped containers' images, images of LIVE deployments, Postgres/MySQL/MariaDB/Redis images, and **all Docker volumes** (database data). Cleanup is skipped whenever a deployment/build is running. The **Safe Cleanup** button runs the emergency-level steps on demand; every run is recorded in the cleanup history.

Tunables (env): `STORAGE_AUTO_CLEANUP=false`, `STORAGE_WARN_PCT`, `STORAGE_CLEANUP_PCT`, `STORAGE_EMERGENCY_PCT`, `STORAGE_CHECK_INTERVAL_MIN`.

**Log rotation:** new app containers get `json-file` logs capped at 3 × 10 MB. For all other containers, set a daemon default in `/etc/docker/daemon.json` (fresh installs do this automatically) and restart Docker; existing containers must be recreated to pick it up:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```

## Health alerts, notifications and rollback

- **Docker Health** (admin dashboard) shows daemon problems such as `failed to start shim` / containerd mismatches with the fix (`sudo systemctl restart containerd docker`), plus unhealthy, crash-looping and unexpectedly stopped containers.
- **Notifications** (Admin > Settings): webhook (Slack/Discord/JSON), Telegram, or email for failed deploys, disk thresholds, unhealthy containers, Docker problems and signups awaiting approval. Email needs `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (optional `SMTP_SECURE=true`) in the server `.env`. Repeated alerts are rate-limited.
- **Rollback**: the last 2 superseded versions of each single-container app keep their image. Use *Rollback* in the project's Deployment History. Compose projects and deployments made before this feature cannot be rolled back. Rollback images are protected from automatic cleanup; only an emergency (>= 95% disk) cleanup may remove them.

## Backups, audit log and password reset

**Database backups** (project page > Database backups, and Admin > Settings for the platform DB)
- Daily automatic backup of every project PostgreSQL / MariaDB database and of CloudDabba's own database; last 7 kept (manual: 10, safety backups before a restore: 3). Redis is not backed up.
- Files are gzipped SQL in `backups/` next to the app (override with `BACKUP_DIR`), never touched by Docker cleanup. Back this directory up off-server too: a backup on the same disk does not survive a disk failure.
- Needs dump tools on the server: `pg_dump`/`psql` (install `postgresql-client`; if missing, CloudDabba falls back to `docker exec` into the Postgres container, name set by `PG_DOCKER_CONTAINER`, default `clouddabba-db`) and `mariadb-dump`/`mysqldump` for MariaDB. `PG_DUMP_PATH` / `PSQL_PATH` override the binaries.
- Restore replaces the database contents; a safety backup of the current data is taken first and the restore is refused if that backup fails. PostgreSQL restores run in a single transaction (all or nothing).
- Restore the platform DB manually: `gunzip -c backup.sql.gz | psql "$DATABASE_URL"`.
- Other env: `BACKUP_AUTO=false` disables the schedule, `BACKUP_RETENTION=7`.

**Audit log** (Admin > Audit Log): who did what and from which IP - logins (including failures), signups, approvals, role changes, impersonation, deletes, deployments/rollbacks, resource limits, database and backup actions, settings changes, password resets. Entries are kept 180 days. Actions taken while an admin is impersonating a user show "via admin ...".

**Password reset**: "Forgot password?" on the login page emails a single-use link (valid 1 hour); needs SMTP (see Notifications). Without SMTP, an admin can create a link from Admin > Users (key icon) and send it to the user. Resetting a password signs out all existing sessions. Set `APP_URL` (e.g. `https://panel.example.com`) if the link should not use the configured base domain.
