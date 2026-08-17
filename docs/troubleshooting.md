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
