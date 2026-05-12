# Database Provisioning

Each project can request a dedicated PostgreSQL, MariaDB, and/or Redis instance. Toggle them on in the deploy wizard or on the project page.

## Injected URLs

CloudDabba auto-injects connection URLs as environment variables on every deploy:

| Database | Env var injected |
|----------|------------------|
| PostgreSQL | `DATABASE_URL` |
| MariaDB | `MYSQL_URL` |
| Redis | `REDIS_URL` |

Each project gets unique credentials. Connection details are visible on the project page (masked, with reveal + copy buttons).

## Test Connection

Each database card has a **Test Connection** button that runs a real connection check from inside a deployed container and reports back. Useful for diagnosing networking / firewall issues.

## How it works under the hood

| Layer | Detail |
|-------|--------|
| Postgres | Runs in `clouddabba-db` Docker container. CloudDabba uses raw `pg.Client` to `CREATE DATABASE` + user (Prisma can't run DDL in transactions). |
| MariaDB | Runs on the host (apt-installed). CloudDabba uses `mysql2` to provision per-project DB + user. |
| Redis | Runs in `clouddabba-redis` container. Each project gets a dedicated DB number (1–15). |
| Network | Docker bridge IP (`172.17.0.1`) is used so deployed containers can reach host services. UFW rules `from 172.17.0.0/16 to any port {5432,6379,3306}` are added by `install.sh`. |

## Admin overview

`/admin/databases` lists every provisioned database across all projects with size, owner, and delete controls. Useful for capacity planning and decommissioning orphaned databases.
