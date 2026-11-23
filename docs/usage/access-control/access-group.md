# Access Group

The valid operations that can be performed on an access group are:

| **Operation**  | **Description**                        | **Access Level**                                                                                                    |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| view           | View the Access Group                  | <Any hint="Need to be inside an affiliation group" />                                                               |
| create         | Create a new Access Group              | <Create hint="The create rights need to be from an affiliation group"/>                                             |
| add user       | Add a user to Access Group             | <CanEdit/>                                                                                                          |
| remove user    | Remove a user from the Access Group    | <CanEdit/>                                                                                                          |
| add project    | Add a project to the Access Group      | <Modify hint="The user needs at least the rights they grant the access group on the project, and at least Modify"/> |
| remove project | Remove a project from the Access Group | <Delete/>                                                                                                           |
| delete         | Delete the Access Group                | <CanEdit/>                                                                                                          |

You can add several users, or add the group to several projects, in one step. Kleinkram then adds all of them or none:
if one user is already a member, or you lack the rights on one of the projects, nothing changes and the dialog shows
the reason, so you can correct the selection and try again. One step takes at most 100 users or projects; the
dialog stops at 100, so add those first and then the rest.

## Group Types

There are four types of access groups:

| Type            | Created by                    | Members                                                           | Can be changed by users         |
| --------------- | ----------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| **Custom**      | A user, in the web interface  | Added and removed by the group's editors                          | Yes                             |
| **Primary**     | Kleinkram, one for every user | Only that user; used to give a single user access                 | No                              |
| **Affiliation** | Kleinkram, per email domain   | Every user whose email address is on that domain                  | No                              |
| **Public**      | Kleinkram, once               | Every user, implicitly; granting it access makes a project public | No; can only be granted <Read/> |

See [Base Concepts](./base-concepts.md#access-groups) for how affiliation groups, primary groups and public projects work.

When you search for users to add, you see a user's full email address only if you are both active members of the same
affiliation group, or if you typed their exact address. Otherwise you see a masked hint such as `d•••••@ethz.ch`.

## Membership Expiry

When you add a user to a custom access group, you can let the membership expire: after one week, one month, six months,
one year, or on a date you choose. The default is _Never_. The group's member list shows each membership as _Active_ or
_Expired_.

Access to projects through the group ends when the membership expires. Kleinkram removes expired memberships from the
group every four hours; until then, access to missions granted to the group still applies.
