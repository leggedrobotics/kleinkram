# Database Migration

We rely on TypeORM Migrations to manage database schema changes safely and efficiently. See [TypeORM Migrations](https://typeorm.io/migrations) for more information.

::: warning Working Directory
All commands on this page must be run from the `/backend/` directory.
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

**If CI fails:** You likely changed an entity but forgot to generate a migration. Run the clean generation command locally and commit the result. You can verify this locally before pushing:

```bash
pnpm run migration:check
```

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
   Edit `migration/.env` with your database connection details.

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
pnpm run typeorm migration:revert -d migration/prod/migration.config.ts
```
