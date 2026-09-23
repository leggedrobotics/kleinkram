# Action and Action Template

## Action

The valid operations that can be performed on an action are:

| **Operation**                        | **Description**         | **Access Level**      |
| ------------------------------------ | ----------------------- | --------------------- |
| view                                 | View an existing Action | <Read />              |
| launch                               | Launch an Action        | <Create />            |
| delete                               | delete an Action        | <Delete /> <Creator/> |
| - **Delete**: Can delete the action. |

### Example

**Scenario**: A custom action "Convert to TUM Format" is developed by the "Perception Team".

- **Developers**: The "Perception Team" needs to update the action definition. They get `Write` access.
- **Users**: All users in the "Robotics Corp" project need to _run_ this action. They get `Read` access (which allows execution).
- **Restricted Action**: An experimental "Delete Outliers" action might be restricted to senior engineers only, so only they are granted `Read` access to it.
  | stop | Stop an Action | <Delete /> <Creator/> |

## Action Template

The valid operations that can be performed on an action template are:

| **Operation** | **Description**                   | **Access Level** |
| ------------- | --------------------------------- | ---------------- |
| view          | View an existing Action Template  | <Any />          |
| create        | Create a new Action Template      | <Create />       |
| delete        | Action Template cannot be deleted | -                |

## Action Trigger

Triggers hang off a mission, so their access level is the access level you hold
on that mission. The valid operations are:

| **Operation** | **Description**                | **Access Level**    |
| ------------- | ------------------------------ | ------------------- |
| view          | View a single Trigger          | <Read /> <Creator/> |
| list          | List the Triggers of a Mission | <Read />            |
| create        | Create a new Trigger           | <Create />          |
| update        | Change an existing Trigger     | <Creator/>          |
| delete        | Delete a Trigger               | <Creator/>          |

Listing triggers without naming a mission returns every trigger you can reach —
those in missions you can read, those in projects you can read, and those you
created yourself. Admins see all of them.

### API Keys

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
trigger's creator. Granting <Read /> on a mission therefore lets someone run
that mission's webhook actions, whatever rights the action template itself
asks for. Treat webhook trigger uuids as secrets.

:::
