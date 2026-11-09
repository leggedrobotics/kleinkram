# Access Group

The valid operations that can be performed on an access group are:

| **Operation**  | **Description**                        | **Access Level**                                                                                                                 |
| -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| view           | View the Access Group                  | <Any hint="Need to be inside an affiliation group" />                                                                            |
| create         | Create a new Access Group              | <Create hint="The create rights need to be from an affiliation group"/>                                                          |
| add user       | Add a user to Access Group             | <CanEdit/>                                                                                                                       |
| remove user    | Remove a user from the Access Group    | <CanEdit/>                                                                                                                       |
| add project    | Add a project to the Access Group      | <Modify hint="The user needs to have at least the access rights he grants the access group on the project and at least Modify"/> |
| remove project | Remove a project from the Access Group | <Delete/>                                                                                                                        |
| delete         | Delete the Access Group                | <CanEdit/>                                                                                                                       |

## Group Types

There are four types of access groups:

| Type            | Created by                    | Members                                                           | Can be changed by users         |
| --------------- | ----------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Custom**      | A user, in the web interface  | Added and removed by the group's editors                          | Yes                             |
| **Primary**     | Kleinkram, one for every user | Only that user; used to give a single user access                 | No                              |
| **Affiliation** | Kleinkram, per email domain   | Every user whose email address is on that domain                  | No                              |
| **Public**      | Kleinkram, once               | Every user, implicitly; granting it access makes a project public | No; can only be granted <Read/> |

See [Base Concepts](./base-concepts.md#access-groups) for how affiliation groups, primary groups and public projects work.

## Membership Expiry

When you add a user to a custom access group, you can let the membership expire: after one week, one month, six months,
one year, or on a date you choose. The default is _Never_. The group's member list shows each membership as _Active_ or
_Expired_.

Access to projects through the group ends when the membership expires. Kleinkram removes expired memberships from the
group every four hours; until then, access to missions granted to the group still applies.
