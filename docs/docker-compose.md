# Docker Compose Apps

For multi-container projects like ERPNext, Frappe, Strapi+DB, Ghost+MySQL — commit a `docker-compose.yml` in the repo root and CloudDabba handles the rest.

## Detection

CloudDabba detects compose projects automatically from:

- `docker-compose.yml`
- `docker-compose.yaml`
- `compose.yml`
- `compose.yaml`

You can also force the type via the **Project Type** dropdown in the deploy wizard.

## Lifecycle

| Stage | What CloudDabba does |
|-------|----------------------|
| Deploy | `docker compose -p cd-<subdomain> down` (idempotent) then `up -d --build --remove-orphans` |
| Redeploy | Same — graceful replace |
| Delete project | `docker compose -p cd-<subdomain> down -v --remove-orphans` (volumes wiped) |

Each project gets its own scoped name (`cd-<subdomain>`) so multiple compose deployments stay isolated.

## Service auto-discovery

CloudDabba picks one "main" service to route traffic to. Order:

1. Service named one of: `frontend`, `web`, `app`, `nginx`, `proxy`, `traefik`, `caddy`, `api`, `server`, `site`
2. Else: service exposing a published port in `{80, 8080, 3000, 5000, 8000, 4000, 8888}`
3. Else: the first service with any `ports:` entry

The host port from that service's port mapping is what NGINX proxies to.

## Tip — avoid port 80 conflicts

If your compose binds host port 80 directly (`"80:80"`), it'll fight CloudDabba's NGINX. Use a high port instead:

```yaml
services:
  frontend:
    ports:
      - "8080:80"
```

CloudDabba will discover host port 8080 and route your subdomain to it.

## Environment variables

Same as regular projects — set them in the deploy wizard or project page. CloudDabba writes them to `.env` in the build context, which `docker compose` reads automatically.

## ERPNext example

ERPNext's official compose works almost as-is. Key thing: change the frontend service's port mapping from `8080:8080` to something CloudDabba can route (keep host port out of 80/443 since NGINX owns those).
