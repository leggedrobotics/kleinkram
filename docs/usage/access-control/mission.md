# Mission

The valid operations that can be performed on a mission are:

| **Operation** | **Description**                  | **Access Level**                                                                                        |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| view          | View an existing Mission         | <Read />                                                                                                |
| create        | Create a new Mission             | <Create />                                                                                              |
| rename        | Rename a Mission                 | <Write />                                                                                               |
| metadata      | Add/Remove metadata on a Mission | <Write />                                                                                               |
| move          | Move a Mission                   | <Delete hint="Delete Rights are required on the Project it is removed from, Create where it is added"/> |
| delete        | Delete a Mission                 | <Delete/>                                                                                               |

The access levels are those on the mission's project: access cannot be granted on a single mission yet.

### Example

**Scenario**: A specific mission "Field Test 2024-11-14" contains sensitive data, and a visiting student needs access
to _only_ this mission.

- **Project Members**: Everyone with access to the project can see the mission.
- **Guest Access**: Move the mission into a separate project and give the student <Read/> on that project.
  Kleinkram's permission model is additive, so access to one mission of a project cannot be taken away from project
  members.
