# Access Rights Management

## Access Rights

There are four possible access rights for any resource (e.g., a project, mission, file, ...):

-   <Read/>: The ability to view the content of a resource.
-   <Create/>: The ability to create new content within a resource.
-   <Modify/>: The ability to change or update an existing resource.
-   <Delete/>: The ability to delete / remove a resource.

These above permission levels are hierarchically ordered and transitive, meaning a higher level (e.g., <Delete/>)
automatically includes the permissions of all lower levels (e.g., <Read/>).

## Base Concepts

Few resources are viewable to any authenticated user. In this documentation, they are marked as <Any/>.

For some resources the creator has more rights. These operations are marked with <Creator/>.

Access rights are linked to two key entities: **projects** and **missions**. Since projects contain missions,
a user’s access rights to a mission is determined by the highest of the following:

-   the access rights on the mission
-   the access rights on the project

### Mission Level Access Implies Project Level Access

If a user has any permission on mission level, they get <Read/> on the project level.

## Access Groups

An access group is a set of users managed. Access groups can be created and managed by users with the appropriate
permissions (see [Affiliation Groups](#affiliation-groups)).

Access Groups can be linked to projects or missions with specific access rights. These rights are applied to all users
within the group. A single access group can be associated with multiple projects, and different access levels can be
assigned for each project. If a user belongs to multiple access groups with varying access levels, the highest level of
access is applied.

## Affiliation Groups

Users may be added to an affiliation group based on their email domain, e.g. uses signing in with
an `@leggedrobotics.com` email address are automatically added to the `Leggedrobotics` affiliation group. An affiliation
group can be treated as a normal group, it can be assigned to a project or mission giving its
members access rights to the resource.

On top of that, affiliation groups can be used to

-   assign default access rights to its members (e.g. all members of the `Leggedrobotics` affiliation group get <Read/> on
    all new projects by default (unless explicitly changed))
-   can restrict or allow global access rights (e.g. all users not part of the `Leggedrobotics` affiliation group are not
    allowed create new projects or creation of new access groups)

## Primary Group

Each user has a primary group. This group has the same name as the user and is automatically created when the user is
created. The primary group is used to assign access rights to a single user.

## User and Admin

By default, all individuals who access the system are classified as "Users." Users can only perform actions that they
have been explicitly granted permission to do.
"Admins" are a subset of Users who have complete and unrestricted access to the system.
Admins can perform any action without limitations.
