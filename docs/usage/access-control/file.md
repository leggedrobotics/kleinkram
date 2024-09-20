# File

The valid operations that can be performed on a file are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View an existing File | <Read /> |
| download | Download a File | <Read /> |
| create | Create a new File | <Create /> |
| rename | Rename a File | <Modify /> <Creator/> |
| move | Move a File | <Delete hint="Delete Rights are required on the Mission it is removed from, Create where it is added"/> <Creator hint="Create where it is added"/> |
| delete | Delete a File | <Delete /> <Creator/> |
