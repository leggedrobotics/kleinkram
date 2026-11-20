# Filtering listings based on user rights

Endpoints that list data return only what the user may read. Instead of checking every row in a guard, they add the
access rules to the database query with the helpers in `backend/src/endpoints/auth/auth-helper.ts`:

| Helper                               | Use for                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `addAccessConstraintsToProjectQuery` | Queries on `ProjectEntity`                                                   |
| `addAccessConstraintsToMissionQuery` | Queries on `MissionEntity`                                                   |
| `addAccessConstraintsToFileQuery`    | Queries on `FileEntity`                                                      |
| `addAccessConstraintsToTriggerQuery` | Queries on `ActionTriggerEntity`                                             |
| `addAccessConstraints`               | Other queries that join `project` and `mission` (e.g. topics, queue entries) |

Each helper takes the query builder and the UUID of the user, and restricts the query to the rows the user can read
through the access views (`project_access_view_entity`, `mission_access_view_entity`). Admins see every row.

```ts
let query = this.projectRepository.createQueryBuilder('project');
query = addAccessConstraintsToProjectQuery(query, user.uuid);
query.andWhere('project.name ILIKE :name', { name: `%${search}%` });
const [projects, count] = await query.getManyAndCount();
```

::: warning
The helpers refer to the entities by the aliases `project`, `mission` and `file`, so the query must use these aliases.
:::
