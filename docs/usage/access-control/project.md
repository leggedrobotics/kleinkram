# Project

The valid operations that can be performed on a project are:

| **Operation**   | **Description**              | **Access Right**                                                        |
|-----------------|------------------------------|-------------------------------------------------------------------------|
| view            | View an existing project     | <Read/>                                                                 |
| create          | Create a new project         | <Create hint="The create rights need to be from an affiliation group"/> |
| add Metadata    | Add Metadata to project      | <Modify/>                                                               |
| remove Metadata | Remove Metadata from project | <Modify/>                                                               |
| rename          | Rename the project           | <Modify/>                                                               |
| delete          | Delete the project           | <Delete/>                                                               |

## Metadata

| **Operation** | **Description**            | **Access Right**                                                        |
|---------------|----------------------------|-------------------------------------------------------------------------|
| view          | View an existing Metadata  | <Any/>                                                                  |
| create        | Create a new Metadata      | <Create hint="The create rights need to be from an affiliation group"/> |
| delete        | Metadata cannot be deleted | -                                                                       |
