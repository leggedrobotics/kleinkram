# Database Migration

We rely on TypeORM Migrations to manage database schema changes safely and efficiently. See [TypeORM Migrations](https://typeorm.io/migrations) for more information.

::: warning Working Directory
All commands on this page must be run from the `/backend/` directory. The `migration:*` scripts are defined in `backend/package.json`, not in the repository root, so `pnpm run migration:check` from the root fails with `Missing script`.

```bash
cd backend
```

:::

## Local Development (Auto-Sync)

Development environments (e.g., `docker compose up --build --watch`) run with `synchronize: true`.

- **Automatic Updates**: Schema changes in your entities are applied immediately on restart/hot-reload.
- **No Manual Migrations**: You do _not_ need to generate migration files for local iteration.

::: danger Synchronize can cause data loss
`synchronize: true` can cause data loss (e.g., dropping columns). Never use this in production.
:::

## Generating Migrations for Production

When your changes are ready for review or deployment, generate a migration file.

### Recommended: Clean Generation

Generate migrations against a pristine state to prevent local database drift from polluting your migration history. This uses a temporary Docker container to compare your entities against the existing migrations.

```bash
# Usage: pnpm run migration:generate:clean <name>
pnpm run migration:generate:clean add-user-profile
```

### CI Enforcement

Robust pipelines require valid migrations. Our CI runs a check on every PR to `main` that verifies:

1. All migrations are generated.
2. Current entities match the migration state.

**If CI fails:** You likely changed an entity but forgot to generate a migration. Run the clean generation command locally and commit the result. You can verify this locally before pushing (requires Docker, since the check spins up a temporary `postgres:17` container):

```bash
pnpm run migration:check
```

Note that some dependency upgrades change the schema TypeORM derives from unchanged entities (for example, TypeORM 1 changed the default `ON DELETE`/`ON UPDATE` behaviour of many-to-many junction tables). In that case the check fails without any entity change; commit the generated migration under a descriptive name.

### Fallback: Standard Generation

If Docker is unavailable or you prefer to generate migrations based on your local database state, you can use the standard TypeORM CLI commands. _Use with caution._

```bash
pnpm run typeorm migration:generate migration/migrations/migration-name -d migration/dev/migration.config.ts
```

## Production & Staging

Apply migrations using the standard TypeORM CLI commands pointing to the environment-specific configuration.

### Configuration

To run local or manual migrations, you must set up your environment variables.

1. **Copy the example configuration:**

```bash
    cp migration/example.env migration/.env
```

2. **Configure credentials:**
   Edit `migration/.env` with your database connection details. The file is git-ignored. The dev configuration reads the `dev_*` variables, the production configuration the `prod_*` variables (`dbhost`, `port`, `dbname`, `dbuser`, `dbpassword`, `ssl`).

### Check Which Migrations Are Pending

Before applying anything, list the migrations known to the code and whether the target database has them (`[X]` applied, `[ ]` pending). This is read-only.

```bash
# Staging / Dev
pnpm run typeorm migration:show -d migration/dev/migration.config.ts

# Production
pnpm run typeorm migration:show -d migration/prod/migration.config.ts
```

### Apply Migrations

```bash
# Staging / Dev
pnpm run typeorm migration:run -d migration/dev/migration.config.ts

# Production
pnpm run typeorm migration:run -d migration/prod/migration.config.ts
```

### Revert Migrations

Undo the last applied migration if necessary.

```bash
# Staging / Dev
pnpm run typeorm migration:revert -d migration/dev/migration.config.ts

# Production
pnpm run typeorm migration:revert -d migration/prod/migration.config.ts
```

::: warning Enum migrations
Migrations that add a value to a Postgres enum (for example new `FileState` or `ActionState` values) can only be reverted while no row uses the new value; otherwise the `down()` cast fails. See [#2367](https://github.com/leggedrobotics/kleinkram/issues/2367).
:::

## Release Checklist

1. Merge all feature branches into `dev` and make sure the `Check Migrations` workflow is green.
2. Run `migration:show` against the target database and review the pending list.
3. Review each pending migration for backward compatibility with the backend version that is still running (adding columns, enum values or constraints is usually safe; dropping or renaming columns is not). Then run `migration:run` against the target database. Use an expand-and-contract rollout, deploying compatible application code first, when a migration is not safe to apply against the running version.
4. Deploy the new backend.
