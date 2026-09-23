# Project

The valid operations that can be performed on a project are:

| **Operation**   | **Description**                               | **Access Right**                                                        |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| view            | View an existing project                      | <Read/>                                                                 |
| create          | Create a new project                          | <Create hint="The create rights need to be from an affiliation group"/> |
| add Metadata    | Require a metadata type on the project        | <Modify/>                                                               |
| remove Metadata | Stop requiring a metadata type on the project | <Modify/>                                                               |
| rename          | Rename the project                            | <Modify/>                                                               |
| delete          | Delete the project                            | <Delete/>                                                               |

### Example

**Scenario**: A research lab "Robotics Corp" wants to manage access to their "ANYmal Rough Terrain" project.

- **Admins**: The lab directors need full control. They are given `Read`, `Write`, `Delete` rights.
- **Researchers**: The researchers working on the project need to upload data and edit metadata. They are given `Read` and `Write` rights.
- **External Collaborators**: Partners from another university need to view the data but not modify it. They are given `Read` rights.

## Metadata Types

| **Operation** | **Description**                  | **Access Right**                                                        |
| ------------- | -------------------------------- | ----------------------------------------------------------------------- |
| view          | View an existing metadata type   | <Any/>                                                                  |
| create        | Create a new metadata type       | <Create hint="The create rights need to be from an affiliation group"/> |
| delete        | Metadata types cannot be deleted | -                                                                       |
