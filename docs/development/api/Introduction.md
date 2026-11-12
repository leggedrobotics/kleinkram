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

## Deprecated Field Names

Mission metadata used to be called "tags" and metadata types "tag types". The canonical names are `metadata` (a value on
a mission) and metadata type (its definition). Until kleinkram 1.0, the API keeps accepting and returning the old names
as deprecated aliases. If a request contains both, the canonical field wins.

| Where                                         | Canonical               | Deprecated alias |
| :-------------------------------------------- | :---------------------- | :--------------- |
| Mission responses                             | `metadata`              | `tags`           |
| Project responses                             | `requiredMetadataTypes` | `requiredTags`   |
| `POST /missions` (create mission)             | `metadata`              | `tags`           |
| `POST /missions` (create mission)             | `ignoreMissingMetadata` | `ignoreTags`     |
| `POST /missions/:uuid/metadata`               | `metadata`              | `tags`           |
| `POST /projects` (create project)             | `requiredMetadataTypes` | `requiredTags`   |
| `GET /files` query                            | `metadataByTypeUuid`    | `tags`           |
| `PUT /projects/:uuid/metadata-types` (body)   | `metadataTypeUUIDs`     | `tagTypeUUIDs`   |
| `POST /projects/:uuid/metadata-types` (query) | `metadataTypeUUID`      | `tagTypeUUID`    |
