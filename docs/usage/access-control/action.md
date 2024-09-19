# Action and Action Template
## Action
The valid operations that can be performed on an action are:
| **Operation** | **Description**               | **Access Level** |
|---------------|-------------------------------|------------------|
| view          | View an existing Action       | <Read />         |
| launch        | Launch a resource              | <Create />       |
| delete        | delete a resource              | <Delete /> <Creator/>       |
| stop          | Stop a resource                | <Delete />  <Creator/>      |

## Action Template
The valid operations that can be performed on an action template are:
| **Operation** | **Description**               | **Access Level** |
|---------------|-------------------------------|------------------|
| view           | View an existing Action Template | <Any />          |
| create          | Create a new Action Template     | <Create />         |
| delete          | Action Template cannot be deleted       | -       |