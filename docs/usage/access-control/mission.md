# Mission
The valid operations that can be performed on a mission are:
| **Operation** | **Description**               | **Access Level** |
|---------------|-------------------------------|------------------|
| view          | View an existing resource     | <Read />         |
| create        | Create a new resource         | <Create />       |
| rename        | Rename a resource             | <Modify />       |
| tag           | Add/Remove tags on a resource | <Modify />       |
| move          | Move a resource               | <Delete hint="Delete Rights are required on the Project it is removed from, Create where it is added"/>       |
| delete        | Delete a resource             | <Delete/>       |
