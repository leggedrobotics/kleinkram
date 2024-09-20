# Access Rights Management

## Access Rights

There are four possible access rights for any resource:

-   <Read/>: The ability to view the content of a resource.
-   <Create/>: The ability to create new content within a resource.
-   <Modify/>: The ability to change or update an existing resource.
-   <Delete/>: The ability to remove a resource.

These above permission levels are hierarchically ordered and transitive, meaning a higher level (e.g., <Delete/>) automatically includes the permissions of all lower levels (e.g., <Read/>).

Few resources are viewable with any user login. In this documentaion, they are marked as <Any/>.

For some resources the creator has more rights. These are marked as <Creator/>.

Access rights are linked to two key entities: **Projects** and **Missions**. Since Projects contain Missions,
a user’s access rights to a Mission is determined by the higher of the following:

-   The access rights on the mission
-   The access rights on the project

## Organizational Units

An Organizational Unit is a group that assigns default access rights to its members.
When a user creates a Project within their Organizational Unit,
all members of that unit automatically inherit the default access rights for that Project.
Only users who belong to an Organizational Unit are allowed to create Projects. Users are automatically added to their
Organizational Unit based on their email domain.

## Access Groups

An Access Group is a set of users managed by the group’s creator.
Access Groups can be linked to Projects with specific access rights.
These rights are applied to all users within the group.
A single Access Group can be associated with multiple Projects,
and different access levels can be assigned for each Project.

If a user belongs to multiple Access Groups with varying access levels, the highest level of access is applied.

## User and Admin

By default, all individuals who access the system are classified as "Users." Users can only perform actions that they
have been explicitly granted permission to do.
"Admins" are a subset of Users who have complete and unrestricted access to the system.
Admins can perform any action without limitations.
