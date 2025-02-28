# Access Group

The valid operations that can be performed on an access group are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View the Access Group | <Any hint="Need to be inside an affiliation group" /> |
| create | Create a new Access Group | <Create hint="The create rights need to be from an affiliation group"/> |
| add user | Add a user to Access Group | <Creator/> |
| remove user | Remove a user from the Access Group |<Creator/> |
| add project | Add a project to the Access Group | <Modify hint="The user needs to have at least the access rights he grants the access group on the project and at least Modify"/> |
| remove project | Remove a project from the Access Group | <Delete/> |
| delete | Delete the Access Group | <Creator/> |
