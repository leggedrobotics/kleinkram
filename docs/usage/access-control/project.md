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

## Managing Project Access

Granting, changing and removing project access (for a user or an access group) needs <Modify/> on the project, and you
can never act above your own level: you need at least the rights the entry has **before and after** the change.

- To grant <Delete/>, you need <Delete/> yourself.
- To lower or remove an entry that has <Delete/> (for example, to demote a project owner), you need <Delete/> yourself.
- With <Modify/>, you can grant, change and remove entries up to <Modify/>.
- Making a project public or restricted again (**General access**) needs <Delete/>, although public access itself
  is always <Read/>.

Your own level counts only memberships that have not expired. Project access cannot be set higher than <Delete/>, and
every project keeps at least one access group with <Delete/>.

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
