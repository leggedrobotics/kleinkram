# Mission

The valid operations that can be performed on a mission are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View an existing Mission | <Read /> |
| create | Create a new Mission | <Create /> |
| rename | Rename a Mission | <Modify /> |
| tag | Add/Remove tags on a Mission | <Modify /> |
| move | Move a Mission | <Delete hint="Delete Rights are required on the Project it is removed from, Create where it is added"/> |
| delete | Delete a Mission | <Delete/> |

- **Delete**: Can delete the mission.

### Example

**Scenario**: A specific mission "Field Test 2024-11-14" contains sensitive data.

- **Project Members**: By default, they inherit their project-level access.
- **Sensitive Data Handling**: If this specific mission requires stricter control, you could potentially restrict access (though currently, Kleinkram's permission model is additive).
- **Guest Access**: A visiting student needs access to *only* this mission. You can grant them `Read` access specifically to this mission without giving them access to the entire project.
