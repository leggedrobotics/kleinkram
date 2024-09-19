# File
The valid operations that can be performed on a file are:
| **Operation** | **Description**               | **Access Level** |
|---------------|-------------------------------|------------------|
| view          | View an existing resource      | <Read />         |
| download      | Download a resource            | <Read />         |
| create        | Create a new resource          | <Create />       |
| rename        | Rename a resource              | <Modify />    <Creator/>   |
| move          | Move a resource                | <Delete hint="Delete Rights are required on the Mission it is removed from, Create where it is added"/> <Creator hint="Create where it is added"/>       |
| delete        | Delete a resource              | <Delete />   <Creator/>    |
