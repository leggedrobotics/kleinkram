# Action and Action Template

## Action

The valid operations that can be performed on an action are:

| **Operation** | **Description**              | **Access Level**                                                                               |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| view          | View an existing Action      | <Read />                                                                                       |
| launch        | Launch an Action             | <Modify hint="Or the template's access rights, if those are higher (e.g. Delete)"/>            |
| stop          | Stop a queued/running Action | <Modify hint="Or the template's access rights, if those are higher (e.g. Delete)"/> <Creator/> |
| delete        | Delete a finished Action     | <Delete /> <Creator/>                                                                          |

Running an action counts as a write operation on the mission, so launching one needs at least <Modify/> on the
mission, even when the template only asks for <Read/>.

A template's access rights are the rights of the API key the action container gets. They can raise what you need to
launch the action but never lower it: a template that asks for <Delete/> can only be launched by someone who holds
<Delete/> on the mission. This way nobody can hand an action more rights than they hold themselves.

The check runs twice: when you submit the action, and again when a worker starts it. If you lose access while the
action is still queued, it fails with `MISSION_ACCESS_LOST` instead of running.

### Example

**Scenario**: A custom action "Convert to TUM Format" reads the raw recordings of a mission and uploads the converted
files to it. Its template asks for `Write` access.

- **Researchers** in the project have `Write` access, so they can launch the conversion.
- **External reviewers** only have `Read` access. They can see the action, its logs and its artifacts, but they cannot
  launch it.
- **Restricted Action**: An experimental "Delete Outliers" action asks for `Delete` access, so only users who already
  hold `Delete` on the mission can launch it.

## Action Template

The valid operations that can be performed on an action template are:

| **Operation** | **Description**                                        | **Access Level**            |
| ------------- | ------------------------------------------------------ | --------------------------- |
| view          | View an existing Action Template                       | <Any />                     |
| create        | Create a new Action Template                           | <Create />                  |
| new version   | Save a new version of an Action Template               | <Creator/> or administrator |
| delete        | Delete (or archive, if it has run) all of its versions | <Creator/> or administrator |

The creator of a template is the person who saved its first version. Saving a later version does not make you an owner,
so only the original creator (or an administrator) can keep changing or deleting it. To run a changed copy of someone
else's template, save it as a new template under a new name. A new version always keeps the template's name.
Platform templates such as `script-runner` cannot be changed or deleted by anyone through the API.

## Action Trigger

Triggers hang off a mission, so their access level is the access level you hold
on that mission. A trigger launches actions as its creator, so creating one
needs the same <Modify /> access as launching an action. The valid operations
are:

| **Operation** | **Description**                | **Access Level**    |
| ------------- | ------------------------------ | ------------------- |
| view          | View a single Trigger          | <Read /> <Creator/> |
| list          | List the Triggers of a Mission | <Read />            |
| create        | Create a new Trigger           | <Modify />          |
| update        | Change an existing Trigger     | <Creator/>          |
| delete        | Delete a Trigger               | <Creator/>          |

Listing triggers without naming a mission returns every trigger you can reach —
those in missions you can read, those in projects you can read, and those you
created yourself. Admins see all of them.

### API Keys

The action container gets its key in `KLEINKRAM_API_KEY`. The key only works while the action runs: it is revoked
when the action ends, and it never outlives the action's runtime limit by more than one hour.

An API key is scoped to exactly one mission and carries its own rights level. On
trigger endpoints that scope is the ceiling, and nothing widens it:

- Having **created** the trigger does not let a key read it from outside the
  key's mission.
- Being an **admin** does not either — a key is never an admin.
- Passing a different `missionUuid` when listing does not escape the scope; the
  key's own mission is always used.

So a key issued for `Field Test 2024-11-14` reads that mission's triggers and
nothing else, even when its owner can reach far more through the web app.

::: warning Webhook trigger uuids are capabilities

`POST /hooks/actions/:uuid` is unauthenticated, and `:uuid` is the trigger's
uuid. Anyone who learns it can fire the action, and the action runs as the
trigger's creator, with the creator's access checked, not the caller's. A
caller needs no rights on the mission at all, so even someone with only
<Read /> access (or none) can start that mission's webhook actions. Treat
webhook trigger uuids as secrets.

:::
