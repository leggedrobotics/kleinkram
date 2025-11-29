# Action and Action Template

## Action

The valid operations that can be performed on an action are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View an existing Action | <Read /> |
| launch | Launch an Action | <Create /> |
| delete | delete an Action | <Delete /> <Creator/> |
|- **Delete**: Can delete the action.

### Example

**Scenario**: A custom action "Convert to TUM Format" is developed by the "Perception Team".

- **Developers**: The "Perception Team" needs to update the action definition. They get `Write` access.
- **Users**: All users in the "Robotics Corp" project need to *run* this action. They get `Read` access (which allows execution).
- **Restricted Action**: An experimental "Delete Outliers" action might be restricted to senior engineers only, so only they are granted `Read` access to it.
| stop | Stop an Action | <Delete /> <Creator/> |

## Action Template

The valid operations that can be performed on an action template are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View an existing Action Template | <Any /> |
| create | Create a new Action Template | <Create /> |
| delete | Action Template cannot be deleted | - |
