# API Documentation

For each entity, the API provides a named controller, thus all requests are grouped by entity. The API follows the
RESTful API design principles.

Available Modules are:

- [`project`](project.md) - Handles the authentication and authorization.
- [`access`](access.md) - Handles access control.
- [`user`](user.md) - Handles the user related requests.
- [`auth`](auth.md) - Handles the authentication and authorization.
- [`mission`](mission.md) - Handles the mission related requests.
- [`tag`](tag.md) - Shared for `Metadata`
- [`file`](file.md) - Handles the file related requests.
- [`topic`](topic.md) - Handles the topic related requests.
- [`action`](action.md) - Handles the action related requests.
- [`queue`](queue.md) - Handles the queue related requests.
- [`category`](category.md) - Handles the category related requests.

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

:::
