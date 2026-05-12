# Deploying Apps

From the dashboard, click **Deploy a Project** and follow the 3-step wizard: pick a source, pick a branch, configure & deploy.

## Sources

- **GitHub** — connect via personal access token (Settings → GitHub), then pick a repo
- **Public URL** — paste any public git URL (`https://github.com/user/repo.git`)
- **ZIP upload** — drag-and-drop a `.zip` of your project

## Project types

CloudDabba auto-detects the type from your repo contents. Manual override is available in the wizard.

| Type | Auto-detected from | Build |
|------|--------------------|-------|
| `NODE_BACKEND` | Express, Fastify, NestJS, Koa, Hapi, AdonisJS, Nuxt, SvelteKit in `package.json` | Node multi-stage |
| `REACT_FRONTEND` | React, Vue, Angular, Svelte, Astro, Gatsby, Solid.js | Vite build → nginx (SPA fallback baked in) |
| `NEXTJS_APP` | `next` dependency or `next.config.*` | Next.js standalone |
| `STATIC_SITE` | `index.html` in root with no package.json | nginx static (SPA fallback baked in) |
| `FULLSTACK` | Separate `backend/` + `frontend/` directories | Combined nginx + node container |
| `DOCKER_COMPOSE` | `docker-compose.yml` in root | `docker compose up -d --build` |
| `CUSTOM_DOCKERFILE` | `Dockerfile` in root | Your own Dockerfile |

## Subdirectory apps

If `package.json` lives in a subdirectory (e.g. `/notes-app/package.json`), CloudDabba detects it and hoists the subdirectory to root before building — same as Vercel.

## Environment variables

Set env vars in the deploy wizard or later from the project page. Three ways to add them:

- **Manual** — Add button, key + value
- **Paste .env** — paste raw `.env` content, parsed line by line
- **Upload** — pick a local `.env` file

CloudDabba writes them to `.env`, `.env.local`, `.env.production`, and `.env.production.local` in the build context, so build-time tools like `next build`, `vite build`, `prisma generate` can read them. They're also injected into the running container at runtime.

## Custom subdomain

By default the subdomain is auto-generated from the project name. Edit it in the wizard — a green checkmark confirms availability against the base domain.

## Auto-deploy on git push

Project page → Auto-Deploy → Enable. Copy the webhook URL + secret into your GitHub repo:

1. Repo → Settings → Webhooks → Add webhook
2. Paste the URL + secret
3. Content type: `application/json`
4. Events: Just the push event
5. Save

Every push to the project's deploy branch triggers a new build automatically.

## Build logs

The wizard redirects to a live log view at `/logs/:deploymentId`. Build output streams via WebSocket. After the container is up, switch to "Runtime" mode to see the app's stdout/stderr.
