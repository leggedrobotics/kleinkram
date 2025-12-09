# Postgres

Auto-generated documentation from TypeORM entities.

Entities are located in `../packages/backend-common/src/entities`.

<h2 id="accessgroupentity-access_group">AccessGroupEntity (access_group)</h2>

Defined in: `auth/accessgroup.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null |  |
| `memberships` | [GroupMembershipEntity](#groupmembershipentity-group_membership)[] | OneToMany |  |
| `project_accesses` | [ProjectAccessEntity](#projectaccessentity-project_access)[] | OneToMany |  |
| `mission_accesses` | [MissionAccessEntity](#missionaccessentity-mission_access)[] | OneToMany |  |
| `type` | `enum` | Not Null |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `hidden` | `boolean` | Not Null | A hidden access group is not returned in any search queries. Hidden access groups may still be accessed by referenced by UUID (e.g., when listing groups with access to a project).  |

---

<h2 id="accountentity-account">AccountEntity (account)</h2>

Defined in: `auth/account.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `provider` | `enum` | Not Null |  |
| `user` | [UserEntity](#userentity-user) | Nullable |  |
| `oauthID` | `string` | Not Null |  |

---

<h2 id="actionentity-action">ActionEntity (action)</h2>

Defined in: `action/action.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `state` | `enum` | Not Null |  |
| `container` | `Container` | Nullable |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `state_cause` | `string` | Nullable |  |
| `executionStartedAt` | `Date` | Nullable |  |
| `executionEndedAt` | `Date` | Nullable |  |
| `actionContainerStartedAt` | `Date` | Nullable |  |
| `actionContainerExitedAt` | `Date` | Nullable |  |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable |  |
| `logs` | `ContainerLog[]` | Nullable |  |
| `auditLogs` | `unknown[]` | Nullable |  |
| `exit_code` | `number` | Nullable |  |
| `artifact_path` | `string` | Nullable |  |
| `artifacts` | `enum` | Not Null |  |
| `artifact_size` | `number` | Nullable |  |
| `artifact_files` | `string[]` | Nullable |  |
| `key` | [ApikeyEntity](#apikeyentity-apikey) | Nullable |  |
| `template` | [ActionTemplateEntity](#actiontemplateentity-action_template) | FK, Nullable |  |
| `image` | `Image` | Nullable |  |
| `worker` | [WorkerEntity](#workerentity-worker) | FK, Nullable |  |

---

<h2 id="actiontemplateentity-action_template">ActionTemplateEntity (action_template)</h2>

Defined in: `action/action-template.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `image_name` | `string` | Not Null |  |
| `name` | `string` | Not Null |  |
| `description` | `string` | Not Null |  |
| `creator` | [UserEntity](#userentity-user) | FK, Not Null |  |
| `command` | `string` | Nullable |  |
| `actions` | [ActionEntity](#actionentity-action)[] | OneToMany |  |
| `version` | `number` | Not Null |  |
| `isArchived` | `boolean` | Not Null |  |
| `cpuCores` | `number` | Not Null |  |
| `cpuMemory` | `number` | Not Null |  |
| `gpuMemory` | `number` | Not Null |  |
| `maxRuntime` | `number` | Not Null |  |
| `entrypoint` | `string` | Nullable |  |
| `accessRights` | `enum` | Not Null |  |

---

<h2 id="apikeyentity-apikey">ApikeyEntity (apikey)</h2>

Defined in: `auth/apikey.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `apikey` | `string` | Not Null |  |
| `key_type` | `enum` | Not Null |  |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Not Null |  |
| `action` | [ActionEntity](#actionentity-action) | Nullable |  |
| `user` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `rights` | `enum` | Not Null |  |

---

<h2 id="baseentity-baseentity">BaseEntity (BaseEntity)</h2>

Defined in: `base-entity.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | `uuid (PK)` | Not Null | Unique UUID for the entity |
| `createdAt` | `timestamp` | Not Null | Timestamp of when the entity was created |
| `updatedAt` | `timestamp` | Not Null | Timestamp of when the entity was last updated |
| `deletedAt` | `Date` | Nullable | Timestamp of when the entity was deleted. This field is used to soft-delete entities. |

---

<h2 id="categoryentity-category">CategoryEntity (category)</h2>

Defined in: `category/category.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null |  |
| `project` | [ProjectEntity](#projectentity-project) | FK, Nullable |  |
| `files` | [FileEntity](#fileentity-file_entity)[] | ManyToMany |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |

---

<h2 id="fileentity-file_entity">FileEntity (file_entity)</h2>

Defined in: `file/file.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable |  |
| `date` | `Date` | Not Null |  |
| `topics` | [TopicEntity](#topicentity-topic)[] | OneToMany |  |
| `filename` | `string` | Not Null |  |
| `size` | `bigint` | Nullable |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable | The user who uploaded the file. |
| `type` | `enum` | Not Null |  |
| `state` | `enum` | Not Null |  |
| `hash` | `string` | Nullable |  |
| `categories` | [CategoryEntity](#categoryentity-category)[] | ManyToMany |  |
| `parent` | [FileEntity](#fileentity-file_entity) | FK, Nullable | The parent file this file was derived from. e.g., If this is a .mcap converted from a .bag, the .bag is the parent. |
| `derivedFiles` | [FileEntity](#fileentity-file_entity)[] | OneToMany | Files derived from this file. |
| `origin` | `enum` | Nullable |  |

---

<h2 id="fileevententity-file_event">FileEventEntity (file_event)</h2>

Defined in: `file/file-event.entity.ts`

### Indices

| Index Definition |
| :--- |
| Column `mission`: `@Index()` |

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `uuid` | `string` | Not Null |  |
| `createdAt` | `timestamp` | Not Null |  |
| `type` | `enum` | Not Null |  |
| `details` | `jsonb` | Not Null | JSON payload for specific details. e.g. { oldName: "foo.bag", newName: "bar.bag" } or { error: "Corrupted header" } |
| `filenameSnapshot` | `string` | Not Null | Snapshot of the filename at the time of the event. Useful if the FileEntity is deleted later. |
| `actor` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `file` | [FileEntity](#fileentity-file_entity) | FK, Nullable | Relation to the file. CHANGED: onDelete set to CASCADE to delete this event if the file is deleted. |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable | Relation to Mission. Useful for filtering logs by mission even if the file is gone. |
| `action` | `any` | FK, Nullable |  |

---

<h2 id="groupmembershipentity-group_membership">GroupMembershipEntity (group_membership)</h2>

Defined in: `auth/group-membership.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |  |
| `user` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `expirationDate` | `Date` | Nullable | The expiration date of the group membership.  If the expiration data is set, the user will be treated as if they were not part of the group after the expiration date.  If the expiration date is not set, the user will be treated as part of the group indefinitely.  |
| `canEditGroup` | `boolean` | Not Null | If the user is a group admin, they can manage the group. Group admins can add and remove users from the group.  |

---

<h2 id="ingestionjobentity-ingestion_job">IngestionJobEntity (ingestion_job)</h2>

Defined in: `file/ingestion-job.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `identifier` | `string` | Not Null | The unique identifier of the file.  This is the Google Drive ID for files imported from Google Drive or the UUID for file entities created in the system for files uploaded.  |
| `displayName` | `string` | Not Null | The name of the file as displayed to the user in the queue list  |
| `state` | `enum` | Not Null |  |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable |  |
| `location` | `enum` | Not Null |  |
| `processingDuration` | `number` | Nullable |  |
| `errorMessage` | `string` | Nullable | Error message if the ingestion failed. |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `file` | [FileEntity](#fileentity-file_entity) | FK, Nullable | Link to the actual FileEntity once created. This allows us to easily join Queue -> File. CHANGED: onDelete set to CASCADE to delete this job if the file is deleted. |

---

<h2 id="metadataentity-tag">MetadataEntity (tag)</h2>

Defined in: `metadata/metadata.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `value_string` | `string` | Nullable |  |
| `value_number` | `number` | Nullable |  |
| `value_boolean` | `boolean` | Nullable |  |
| `value_date` | `Date` | Nullable |  |
| `value_location` | `string` | Nullable |  |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable |  |
| `tagType` | [TagTypeEntity](#tagtypeentity-tag_type) | FK, Nullable |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |

---

<h2 id="missionaccessentity-mission_access">MissionAccessEntity (mission_access)</h2>

Defined in: `auth/mission-access.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `rights` | `enum` | Not Null |  |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |  |
| `mission` | [MissionEntity](#missionentity-mission) | FK, Nullable |  |

---

<h2 id="missionentity-mission">MissionEntity (mission)</h2>

Defined in: `mission/mission.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null |  |
| `project` | [ProjectEntity](#projectentity-project) | FK, Nullable |  |
| `files` | [FileEntity](#fileentity-file_entity)[] | OneToMany |  |
| `actions` | [ActionEntity](#actionentity-action)[] | OneToMany |  |
| `ingestionJobs` | [IngestionJobEntity](#ingestionjobentity-ingestion_job)[] | OneToMany |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `api_keys` | [ApikeyEntity](#apikeyentity-apikey)[] | OneToMany |  |
| `mission_accesses` | [MissionAccessEntity](#missionaccessentity-mission_access)[] | OneToMany |  |
| `tags` | [MetadataEntity](#metadataentity-tag)[] | OneToMany |  |

---

<h2 id="projectaccessentity-project_access">ProjectAccessEntity (project_access)</h2>

Defined in: `auth/project-access.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `rights` | `enum` | Not Null |  |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |  |
| `project` | [ProjectEntity](#projectentity-project) | FK, Nullable |  |

---

<h2 id="projectentity-project">ProjectEntity (project)</h2>

Defined in: `project/project.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null | The name of the project. This is the name that will be displayed in the UI. The name must be globally unique. |
| `missions` | [MissionEntity](#missionentity-mission)[] | OneToMany |  |
| `project_accesses` | [ProjectAccessEntity](#projectaccessentity-project_access)[] | OneToMany |  |
| `description` | `string` | Not Null |  |
| `creator` | [UserEntity](#userentity-user) | FK, Nullable |  |
| `requiredTags` | [TagTypeEntity](#tagtypeentity-tag_type)[] | ManyToMany |  |
| `categories` | [CategoryEntity](#categoryentity-category)[] | OneToMany |  |
| `autoConvert` | `boolean` | Nullable |  |

---

<h2 id="tagtypeentity-tag_type">TagTypeEntity (tag_type)</h2>

Defined in: `tagType/tag-type.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null |  |
| `description` | `string` | Nullable |  |
| `datatype` | `enum` | Not Null |  |
| `project` | [ProjectEntity](#projectentity-project)[] | ManyToMany |  |
| `tags` | [MetadataEntity](#metadataentity-tag)[] | OneToMany |  |

---

<h2 id="topicentity-topic">TopicEntity (topic)</h2>

Defined in: `topic/topic.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null |  |
| `type` | `string` | Not Null |  |
| `nrMessages` | `bigint` | Nullable |  |
| `messageEncoding` | `string` | Not Null |  |
| `frequency` | `number` | Not Null |  |
| `file` | [FileEntity](#fileentity-file_entity) | FK, Nullable |  |

---

<h2 id="userentity-user">UserEntity (user)</h2>

Defined in: `user/user.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `name` | `string` | Not Null | The name of the user. This is the name that will be displayed in the UI. The name gets automatically extracted from the oauth provider.  @example 'John Doe' |
| `email` | `string` | Nullable | The email of the user. This is the email that will be displayed in the UI. The email gets automatically extracted from the oauth provider.  @example 'john.doe@example.com'  The email is unique and cannot be changed.  |
| `role` | `enum` | Nullable | The role of the user. The role determines what the user can do in the application.  @example 'USER'  @see UserRole  |
| `hidden` | `boolean` | Nullable | A hidden user is not returned in any search queries. Hidden users may still be accessed by their UUID (e.g., when listing group memberships).  |
| `avatarUrl` | `string` | Nullable | The avatar url of the user. This is the url of the avatar that will be displayed in the UI. The avatar url gets automatically extracted from the oauth provider.  @example 'https://example.com/avatar.jpg' |
| `account` | [AccountEntity](#accountentity-account) | Nullable |  |
| `memberships` | [GroupMembershipEntity](#groupmembershipentity-group_membership)[] | OneToMany |  |
| `projects` | [ProjectEntity](#projectentity-project)[] | OneToMany |  |
| `missions` | [MissionEntity](#missionentity-mission)[] | OneToMany |  |
| `files` | [FileEntity](#fileentity-file_entity)[] | OneToMany |  |
| `queues` | [IngestionJobEntity](#ingestionjobentity-ingestion_job)[] | OneToMany |  |
| `submittedActions` | [ActionEntity](#actionentity-action)[] | OneToMany |  |
| `templates` | [ActionTemplateEntity](#actiontemplateentity-action_template)[] | OneToMany |  |
| `tags` | [MetadataEntity](#metadataentity-tag)[] | OneToMany |  |
| `api_keys` | [ApikeyEntity](#apikeyentity-apikey)[] | OneToMany |  |
| `categories` | [CategoryEntity](#categoryentity-category)[] | OneToMany |  |

---

<h2 id="workerentity-worker">WorkerEntity (worker)</h2>

Defined in: `worker/worker.entity.ts`

### Columns

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `identifier` | `string` | Not Null |  |
| `hostname` | `string` | Not Null |  |
| `cpuMemory` | `number` | Not Null |  |
| `gpuModel` | `string` | Nullable |  |
| `gpuMemory` | `number` | Not Null |  |
| `cpuCores` | `number` | Not Null |  |
| `cpuModel` | `string` | Not Null |  |
| `storage` | `number` | Not Null |  |
| `lastSeen` | `Date` | Not Null |  |
| `reachable` | `boolean` | Not Null |  |
| `actions` | [ActionEntity](#actionentity-action)[] | OneToMany |  |

---
