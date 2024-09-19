# Project

The valid operations that can be performed on a project are:

| **Operation**   | **Description**             | **Access Right**                                                          |
|-----------------|-----------------------------|---------------------------------------------------------------------------|
| view            | View an existing project    | <Read/>                                                                   |
| create          | Create a new project        | <Create hint="The create rights need to be from an organizational unit"/> |
| add TagTypes    | Add TagType to project      | <Modify/>                                                                 |
| remove TagTypes | Remove TagType from project | <Modify/>                                                                 |
| rename          | Rename the project          | <Modify/>                                                                 |
| delete          | Delete the project          | <Delete/>                                                                 |


## Tag Type
| **Operation** | **Description**            | **Access Right**                                                          |
|---------------|----------------------------|---------------------------------------------------------------------------|
| view          | View an existing TagType   | <Any/>                                                                    |
| create        | Create a new TagType       | <Create hint="The create rights need to be from an organizational unit"/> |
| delete        | TagTypes cannot be deleted | -                                                                         |