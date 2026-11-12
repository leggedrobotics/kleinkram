# Implementation

Currently, two methods of authentication are supported: Google and Api Key.
Every regular user should authenticate using Google. Api keys are only used for actions.

## Google Authentication

We use the standard JWT auth flow.
The user logs in to google, which validates the login upon which the backend issues a JWT.

Within the JWT is only the user UUID.
Upon each request, the backend checks the JWT and retrieves the user from the database.
Using this User, using guards, each endpoint validates whether the user has the required rights to access the endpoint.

Common guards are:

- @LoggedIn() - Checks if the user is logged in
- @AdminOnly() - Checks if the user is an admin
- @UserOnly() - Checks if the user is a regular user and not an Api key
- @CanReadProject() - Checks if the user has read rights to the project
- ...

Endpoints that list data, like /oldProject/filtered are often guarded by @UserOnly() and
handle the filtering of the data based on the user rights internally. They will only return the data the user has access to.
For this, the helper function [`addAccessConstraints`](/development/access-control/addAccessConstraints) is used.

## Api Key Authentication

Api keys are currently only used for actions. An Api key grants access in the name of the user that created the key / action.
An Api key has a:

- User - Whom it represents
- Mission - For which it grants access
- Action - In which it is used
- Rights - The rights it grants

As an Api key inherits its rights from the user, on key creation, the rights it has are at maximum the rights of the user on the mission.
Api keys have no rights on projects, only on missions. Thus many listing operations like listing projects and missions are not allowed for Api keys (@UserOnly() guard).

In the middleware (backend/src/UserResolverMiddleware.ts), before the JWT is checked & resolved, the Api key is checked. If an Api key is present,
the user is resolved to the user the key represents. Written into the request object is `req.user = {user: User, apiKey: ApiKey}`.

Each guard is responsible for detecting whether an Api key is present and if so, whether the key grants the required rights.

Files or other entities that are created with an Api key have as the creator the user the key represents.

### Api Key Lifetime

The queue consumer creates the key when it starts the action and revokes it (soft delete) when the run ends. Three
safeguards cover a worker that dies before it gets there:

- `findUserByAPIKey` (`backend/src/endpoints/auth/action-key-validity.ts`) rejects an action key with `401` if its
  action is missing or in a terminal state (`DONE`, `FAILED`, `UNPROCESSABLE`, `CANCELLED`), or if the key is older
  than the action's runtime limit plus one hour. The hour covers the image pull, which happens before the runtime
  limit starts counting.
- On `SIGTERM`, the queue consumer revokes the keys of the actions it is running before it exits.
- At startup and on every janitor run (every 30 seconds), each queue consumer revokes all action keys whose action is
  missing or no longer running. Keys of actions that still run, on any worker, are left alone.

The queue consumer never writes the container environment, which holds the key, to its logs; values are masked as
`***`.
