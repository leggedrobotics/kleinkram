# API Documentation

For each entity, the API provides a named controller, thus all requests are grouped by entity. The API follows the
RESTful API design principles.

Available Modules are:

<ApiModulesTable />

::: warning

The API is not designed to be accessed directly, but rather through the Python package, CLI or via the frontend. If you
want to access it directly, you need to pass a valid `Cookie` header and set the `kleinkram-client-version` header to the
same version as the backend is running.

The latter allows us to display depreciation warnings for outdated client packages.

Example:

```bash
curl 'http://localhost:3000/user/me' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Kleinkram-Client-Version: 0.50.0' \
  -b 'authtoken=...; refreshtoken=...'
```

### API Key Authentication

For programmatic access, you can use an API key. Pass it in the `x-api-key` header.

```bash
curl 'http://localhost:3000/user/me' \
  -H 'x-api-key: YOUR_API_KEY' \
  -H 'Kleinkram-Client-Version: 0.50.0'
```

::: tip

**Exception:** The `/api/health` endpoint does not require a kleinkram client version header.

:::
