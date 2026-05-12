# Platform Settings

Admin Settings (`/admin/settings`) is the operational control panel. Settings split into two categories.

## Editable (DB-backed, applies in ≤30s)

These live in the `platform_settings` table. Changes propagate via a 30-second runtime cache — no restart needed.

| Field | Effect |
|-------|--------|
| Platform Name | Browser tab, setup wizard header, system emails |
| Base Domain | Main domain (use **Change Domain** for full NGINX + SSL switch) |
| Admin Email | Login + system notifications + fallback SSL email |
| SSL Email | Sent to Let's Encrypt for cert renewal reminders |
| Default Git Branch | Pre-filled when users create new projects |
| Allow Signup | ON: anyone can register. OFF: admin-invite only. First user always allowed. |
| CORS Origins | Dynamic per-request. Blank = use `.env` fallback. |

## Infrastructure (.env, restart required)

These live in `backend/.env`. Change them with an editor, then click **Restart Server** (top-right of Settings) to apply.

| Field | .env var |
|-------|----------|
| API Port | `PORT` |
| Environment | `NODE_ENV` |
| Container Port Range | `PORT_RANGE_START` + `PORT_RANGE_END` |
| Secrets | `JWT_SECRET`, `ENCRYPTION_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD` |

## Restart Server button

Schedules `process.exit(0)` after 800ms (response flushes first). PM2 auto-respawns. The UI polls `/api/v1/health` every 2s (up to 60s) and reloads the page once the API is back online.

## Cloud firewall guide

The **Cloud Firewall Setup** card shows provider-specific instructions for opening ports 80/443/6050/10000-20000 in your cloud provider's firewall. Tabs cover AWS EC2, Oracle Cloud, Azure NSG, GCP, DigitalOcean, Hetzner, Vultr, and Linode — `install.sh` handles UFW, but cloud firewalls have to be configured manually in each provider's console.

## Wildcard SSL via Cloudflare

See [custom-domains.md](./custom-domains.md#wildcard-ssl-via-cloudflare).
