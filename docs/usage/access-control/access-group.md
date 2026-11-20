# Access Group

The valid operations that can be performed on an access group are:

| **Operation**  | **Description**                        | **Access Level**                                                                                                  |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| view           | View the Access Group                  | <Any hint="Members of the group, and users who share a project with it" />                                        |
| create         | Create a new Access Group              | <Create hint="The create rights need to be from an affiliation group"/>                                           |
| add user       | Add a user to Access Group             | <CanEdit/>                                                                                                        |
| remove user    | Remove a user from the Access Group    | <CanEdit/>                                                                                                        |
| add project    | Add a project to the Access Group      | <Write hint="The user needs at least the rights they grant the access group on the project, and at least Write"/> |
| remove project | Remove a project from the Access Group | <Delete hint="From the group page. Under Manage Access on the project, Write is enough for entries up to Write"/> |
| delete         | Delete the Access Group                | <CanEdit/>                                                                                                        |

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
group every four hours.

## Your Own Groups

Every user, including users outside an affiliation group, can list the access groups they belong to on the
**Access Groups** page with the **My Groups** filter. Only owners of a group see the email addresses of its members.
