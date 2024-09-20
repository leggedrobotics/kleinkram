# Access Group

The valid operations that can be performed on an access group are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View the Access Group | <Any /> |
| create | Create a new Access Group | <Create /> |
| add user | Add a user to Access Group | <Creator/> |
| remove user | Remove a user from the Access Group |<Creator/> |
| add project | Add a project to the Access Group | <Creator hint="The creator needs to have at least the access rights he grants the access group on the project"/> |
