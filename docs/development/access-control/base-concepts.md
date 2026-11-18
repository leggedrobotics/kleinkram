# Access Control - Basic Concepts

This page describes the basic concepts of the access control in the application.

## Principle of Group Based Access Control

The access control is based on groups. Each user can be a member of multiple groups. A group has no rights of its own:
each access a group is granted on a project or a mission has its own `AccessGroupRights`.

| AccessGroupRights | Value |
| ----------------- | ----- |
| READ              | 0     |
| CREATE            | 10    |
| WRITE             | 20    |
| DELETE            | 30    |

### Primary Group

Each user is member of at least one group, their primary group. This group is unique to each user and is created when
the user is created. Only the user itself is member of this group. No other user can be member of this group.

### Affiliation Groups

Affiliation groups are groups to which user are added automatically based on their mail domain.
These groups are configured per deployment in an `access_config.json`; it is not part of the Docker image.
The backend reads it from `ACCESS_CONFIG_PATH` and refuses to start if it is missing or invalid.
The deployment compose files mount the file from `ACCESS_CONFIG_FILE` (default: `./access_config.json` next to the
compose file). Local development and tests use `backend/access_config.dev.json`.

A user matches an entry if their email ends with `@<email>`; subdomains do not match. On every start, the backend
syncs the affiliation groups and memberships of all users with the config: missing groups and memberships are
created, groups are renamed, and groups and memberships no longer covered by the config are removed. Each change is
logged by `AffiliationGroupService`.

#### Example

```json
{
    "emails": [
        {
            "email": "leggedrobotics.com",
            "access_groups": ["00000000-0000-0000-0000-000000000000"]
        }
    ],
    "access_groups": [
        {
            "name": "Kleinkram Developers",
            "uuid": "00000000-0000-0000-0000-000000000000",
            "rights": 10
        }
    ]
}
```

`rights` is the default access the group gets on newly created projects. Changing it does not update existing projects.

Being a member of any affiliation group is also what lets a user create projects, access groups, metadata types and
action templates (everything guarded by `@CanCreate()`, see `ProjectGuardService.canCreate`). The group's `rights` do not
matter here: members of a group with `"rights": 0` can still create projects. Users who are in no affiliation group
cannot create any of these, unless they are admins.

### Restricting Sign-In to Internal Users

By default anyone with a Google or GitHub account can sign in; users whose email matches no entry in `emails` get an
account without affiliation groups ("external" users). A deployment that should only be open to its own organization
sets `allow_external_users` to `false`:

```json
{
    "allow_external_users": false,
    "emails": [
        {
            "email": "roboticscorp.com",
            "access_groups": ["00000000-0000-0000-0000-000000000000"]
        }
    ],
    "access_groups": [
        {
            "name": "RoboticsCorp",
            "uuid": "00000000-0000-0000-0000-000000000000",
            "rights": 10
        }
    ]
}
```

The option is optional and defaults to `true` (no restriction). With `false`, `emails` must not be empty, and:

- **Sign-up:** a new account is only created for a **verified** email address on one of the domains in `emails`. GitHub
  accounts are checked against all their verified addresses (the primary one is preferred), so a user whose primary
  address is private but who verified a work address on GitHub can sign in; the work address becomes the account's
  email. Google accounts are checked against their email address, which must be verified
  (`email_verified`).
- **Login of an existing user:** the email stored for the user must be on an allowed domain, and the provider must still
  report a verified address on an allowed domain. A user who removed the work address from their GitHub account can no
  longer sign in.
- **Running sessions:** refreshing a session and every request with an access token check the stored email again, so
  after the backend restarts with the restriction, sessions of external users end at once (the API answers `401`).
- **Admins are not exempt.** An admin with an external email is locked out like any other user; add their domain or
  give the role to an internal user before switching the restriction on.

A refused login is redirected to the login page of the frontend, which shows the reason. The fake OAuth provider used in
development and tests counts its email as verified. API keys of actions are not affected.

## How Access is Checked?

Below is the default check for access rights. For the case of authentication using Api Keys, as used in actions, a
different flow is used.

```mermaid
graph TD
    A["AccessCheck(user, right, mission | project)"] --> B{"check if user\nis a global admin"}
    B -->|Yes| C[Access Granted]
    B -->|No| E{"is there a group\n(user, right, project)"}
    E -->|Yes| C[Access Granted]
    E -->|No| G{"is mission"}
    G -->|No| F[Access Denied]
    G -->|Yes| H{"is there a group\n(user, right, mission)"}
    H -->|Yes| C[Access Granted]
    H -->|No| F
```
