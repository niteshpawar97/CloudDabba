# Custom Domains & SSL

## Add a custom domain to a project

1. Project page → **Custom Domain** section
2. Enter the domain (e.g. `app.example.com` or `example.com`)
3. CloudDabba shows DNS records to add at your registrar:
   - Root domain → `A` record pointing to your server IP
   - Subdomain → `CNAME` to the project's auto-generated subdomain (or `A` to server IP)
4. Add the record at your registrar (GoDaddy, Namecheap, Cloudflare, etc)
5. Click **Verify DNS** in the panel
6. On success: NGINX vhost generated + SSL cert issued (Let's Encrypt) + HTTPS live

The original `<project>.<basedomain>` subdomain is automatically configured to **301 redirect** to the custom domain once verified.

Takes ~3–5 minutes end-to-end (DNS propagation + SSL issuance + NGINX reload). Only **one** custom domain per project is supported currently.

## Change the platform's own base domain

Admin Settings → **Platform Domain & SSL** → **Change Domain**. The full flow runs in one click:

1. DNS verification (apex must resolve to this server; wildcard warning is non-fatal)
2. Database update (`PlatformSettings.baseDomain` + optional `sslEmail`)
3. NGINX config regenerated from template, with the previous `/etc/nginx/nginx.conf` backed up to `/tmp` first
4. `nginx -t` validates; on failure the backup is restored and reloaded so the panel never goes dark
5. `nginx -s reload`
6. `certbot --nginx` issues an HTTP-01 cert for the apex
7. CORS origins are auto-updated to include the new domain

## Wildcard SSL via Cloudflare

For `*.yourdomain.com` certs (which cover all deployed app subdomains automatically), CloudDabba ships built-in Cloudflare DNS-01 integration:

### One-time setup

1. Move your domain's DNS to Cloudflare (free plan works — keep registrar wherever you have it)
2. Create a scoped API token at https://dash.cloudflare.com/profile/api-tokens with:
   - **Zone → DNS → Edit**
   - **Zone → Zone → Read**
3. Admin Settings → **Wildcard SSL via Cloudflare** → paste token → **Save**

The token is encrypted (AES-256-CBC) and the on-disk `cloudflare.ini` is root-only (0600).

### Install wildcard cert

Click **Install Wildcard** in the same card. CloudDabba:

1. Installs `python3-certbot-dns-cloudflare` if missing
2. Writes `/etc/letsencrypt/cloudflare.ini` with the decrypted token
3. Runs `certbot certonly --dns-cloudflare -d domain -d *.domain`
4. Cert covers apex + wildcard, auto-renews via certbot's built-in cron

### Why DNS-01 for wildcard

HTTP-01 challenge (what `--nginx` uses by default) can only prove control of specific subdomains. Wildcard certs require DNS-01, which proves DNS control by adding a TXT record. CloudDabba handles the TXT record via Cloudflare's API.

## Diagnostics

The **Platform Domain & SSL** card has three test buttons:

- **Test DNS** — resolves apex + a throwaway wildcard, compares to your server IP
- **Check SSL** — reads `/etc/letsencrypt/live/`, shows issuer, expiry, days remaining, SANs
- **Test Ports** — counts used/free ports in the container range plus a live kernel bind test on the first 5
