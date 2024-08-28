# Kleinkram Access System

Kleinkram utilizes a group-based access control system to manage permissions across projects and missions.

## Key Concepts

1. Group-Based Access Control:

    - Access rights in Kleinkram are assigned to groups, not directly to individual users. However, every user has a particular group that includes only itself. These groups are referred to as personal groups and are created automatically. Personal groups cannot be edited.

    - Users inherit permissions based on their group memberships.

2. Access Rights:

    - Access permissions can be granted at both the project and mission levels.

    - Groups can be assigned one of the following permission levels: **Read**, **Create**, **Write**, or **Delete**.

    - These permission levels are hierarchically ordered and transitive, meaning a higher level (e.g., **Delete**) automatically includes the permissions of all lower levels (e.g., **Read**).

3. Inheritance and Precedence:

    - Missions within that project inherit permissions assigned at the project level and further down to files and actions within those missions.

    - If a user belongs to multiple groups with varying access levels, the highest level of access is applied.

4. User Roles:

    - User accounts have two roles: **User** and **Admin**. By default, all users are assigned the **User** role.

    - The **Admin** role bypasses all access control settings, granting full access to all projects, missions, and files. This role cannot be modified through the user interface.

5. Inheriting Groups:

    - Certain groups, known as **inheriting groups**, are defined globally via a configuration file and cannot be modified through the UI.

    - The **leggedrobotics group** is an example of an inheriting group. It is automatically added to every new project, ensuring that all users have at least **Read** access to all projects and missions.

    - New user accounts are automatically added to inheriting groups based on their email domain.

## Access Levels and Operations

-   **Creating a Project**: Requires membership in an inheriting group with **Create** permissions.

-   **Uploading Files and Creating Missions**: Requires at least **Create** permissions at the mission or project level.

-   **Deleting Files**: Requires **Delete** access.

## More Technical Details

More technical details about the access control system can be found in the [Access Control - Basic Concepts](/development/access-control/base-concepts.md) documentation.
