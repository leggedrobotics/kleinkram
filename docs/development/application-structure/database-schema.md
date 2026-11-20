# Postgres

Generated from the TypeORM entities in `packages/backend-common/src/entities`. Do not edit this page by hand: after changing an entity, run `pnpm --filter kleinkram-docs run gen:entities` and commit the result.

<h2 id="accessgroupentity-access_group">AccessGroupEntity (access_group)</h2>

Defined in: `auth/access-group.entity.ts`

### Indices

| Index Definition                                                                                |
| :---------------------------------------------------------------------------------------------- |
| `@Index('unique_access_group_name', ['name'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column             | Type                                                               | Constraints  | Description                                                                                                                                                                         |
| :----------------- | :----------------------------------------------------------------- | :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | `string`                                                           | Not Null     |                                                                                                                                                                                     |
| `memberships`      | [GroupMembershipEntity](#groupmembershipentity-group_membership)[] | OneToMany    |                                                                                                                                                                                     |
| `project_accesses` | [ProjectAccessEntity](#projectaccessentity-project_access)[]       | OneToMany    |                                                                                                                                                                                     |
| `mission_accesses` | [MissionAccessEntity](#missionaccessentity-mission_access)[]       | OneToMany    |                                                                                                                                                                                     |
| `type`             | `enum`                                                             | Not Null     |                                                                                                                                                                                     |
| `creator`          | [UserEntity](#userentity-user)                                     | FK, Nullable |                                                                                                                                                                                     |
| `hidden`           | `boolean`                                                          | Not Null     | A hidden access group is not returned in any search queries. Hidden access groups may still be accessed by referenced by UUID (e.g., when listing groups with access to a project). |

---

<h2 id="accessgroupevententity-access_group_event">AccessGroupEventEntity (access_group_event)</h2>

Defined in: `auth/access-group-event.entity.ts`

### Indices

| Index Definition                 |
| :------------------------------- |
| Column `accessGroup`: `@Index()` |

### Columns

| Column        | Type                                                 | Constraints  | Description                                                                                                                                |
| :------------ | :--------------------------------------------------- | :----------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`        | `string`                                             | Not Null     |                                                                                                                                            |
| `createdAt`   | `timestamp`                                          | Not Null     |                                                                                                                                            |
| `type`        | `enum`                                               | Not Null     |                                                                                                                                            |
| `details`     | `jsonb`                                              | Not Null     | JSON payload for specific details. e.g. { projectUuid: "...", rights: 10 } Only store UUIDs here, names are resolved when the log is read. |
| `actor`       | [UserEntity](#userentity-user)                       | FK, Nullable |                                                                                                                                            |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Not Null |                                                                                                                                            |

---

<h2 id="accountentity-account">AccountEntity (account)</h2>

Defined in: `auth/account.entity.ts`

### Columns

| Column     | Type                           | Constraints | Description |
| :--------- | :----------------------------- | :---------- | :---------- |
| `provider` | `enum`                         | Not Null    |             |
| `user`     | [UserEntity](#userentity-user) | Nullable    |             |
| `oauthID`  | `string`                       | Not Null    |             |

---

<h2 id="actiondiagnosticentity-action_diagnostic">ActionDiagnosticEntity (action_diagnostic)</h2>

Defined in: `action/action-diagnostic.entity.ts`

### Indices

| Index Definition                                                                       |
| :------------------------------------------------------------------------------------- |
| `@Index('idx_action_diagnostic_dedup', [ 'actionUuid', 'severity', 'code', 'file', ])` |
| Column `action`: `@Index()`                                                            |

### Columns

| Column       | Type                                 | Constraints  | Description                                                                                                                                                                                                                                    |
| :----------- | :----------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`       | `string`                             | Not Null     |                                                                                                                                                                                                                                                |
| `createdAt`  | `timestamp`                          | Not Null     |                                                                                                                                                                                                                                                |
| `severity`   | `enum`                               | Not Null     |                                                                                                                                                                                                                                                |
| `message`    | `string`                             | Not Null     |                                                                                                                                                                                                                                                |
| `code`       | `string`                             | Nullable     | Stable identifier the action author chooses, used to group repeated findings (`MISSING_TF`, `SHORT_RECORDING`). Optional: a one-off warning does not need one.                                                                                 |
| `file`       | `string`                             | Nullable     | Free-text locator for whatever the diagnostic is about, usually a filename. Deliberately not a foreign key: actions warn about paths inside the container, topics and time ranges as often as they warn about files that exist in the mission. |
| `count`      | `integer`                            | Not Null     | How many times this diagnostic was reported. Identical diagnostics are folded into one row with a count rather than stored repeatedly, so a loop over ten thousand files cannot flood the table.                                               |
| `details`    | `jsonb`                              | Nullable     |                                                                                                                                                                                                                                                |
| `action`     | [ActionEntity](#actionentity-action) | FK, Nullable |                                                                                                                                                                                                                                                |
| `actionUuid` | `string`                             | Not Null     |                                                                                                                                                                                                                                                |

---

<h2 id="actionentity-action">ActionEntity (action)</h2>

Defined in: `action/action.entity.ts`

### Indices

| Index Definition                   |
| :--------------------------------- |
| Column `state`: `@Index()`         |
| Column `severity`: `@Index()`      |
| Column `failureOrigin`: `@Index()` |

### Columns

| Column                     | Type                                                                                  | Constraints  | Description                                                                                                                                                                                                                                                                                                                       |
| :------------------------- | :------------------------------------------------------------------------------------ | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`                    | `enum`                                                                                | Not Null     |                                                                                                                                                                                                                                                                                                                                   |
| `severity`                 | `enum`                                                                                | Not Null     | The verdict of the run, orthogonal to `state`. `state` says whether the container reached the end; `severity` says what it found. It is raised by diagnostics reported during the run and by an exit code of 75, and never lowered.                                                                                               |
| `failureOrigin`            | `enum`                                                                                | Nullable     | Who is responsible for a failure. Null unless `state` is `FAILED`, and null for actions that ran before this was recorded.                                                                                                                                                                                                        |
| `diagnostics`              | [ActionDiagnosticEntity](#actiondiagnosticentity-action_diagnostic)[]                 | OneToMany    |                                                                                                                                                                                                                                                                                                                                   |
| `stateTransitions`         | [ActionStateTransitionEntity](#actionstatetransitionentity-action_state_transition)[] | OneToMany    |                                                                                                                                                                                                                                                                                                                                   |
| `diagnosticCount`          | `integer`                                                                             | Not Null     | Number of distinct diagnostics stored for this action. Denormalised so that the action list can show "3 warnings" without joining the diagnostics table for every row.                                                                                                                                                            |
| `diagnosticsTruncated`     | `boolean`                                                                             | Not Null     | True when the action reported more distinct diagnostics than are kept and later ones were dropped.                                                                                                                                                                                                                                |
| `container`                | `Container`                                                                           | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `creator`                  | [UserEntity](#userentity-user)                                                        | FK, Nullable |                                                                                                                                                                                                                                                                                                                                   |
| `state_cause`              | `string`                                                                              | Nullable     | The cause as text: the description at write time, or the raw message of an external error. Kept for search and for clients that predate `state_cause_code`.                                                                                                                                                                       |
| `state_cause_code`         | `string \| null`                                                                      | Nullable     | Why the action is in its current state: an `ActionStateCause`, kept as text (see there). Mirrors the latest row of `stateTransitions`.                                                                                                                                                                                            |
| `state_cause_params`       | `jsonb`                                                                               | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `executionStartedAt`       | `Date`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `executionEndedAt`         | `Date`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `actionContainerStartedAt` | `Date`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `actionContainerExitedAt`  | `Date`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `mission`                  | [MissionEntity](#missionentity-mission)                                               | FK, Nullable |                                                                                                                                                                                                                                                                                                                                   |
| `auditLogs`                | `unknown[]`                                                                           | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `exit_code`                | `number`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `artifact_path`            | `string`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `artifacts`                | `enum`                                                                                | Not Null     |                                                                                                                                                                                                                                                                                                                                   |
| `artifact_size`            | `number`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `artifact_files`           | `string[]`                                                                            | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `artifactExpirationDate`   | `Date`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `key`                      | [ApiKeyEntity](#apikeyentity-apikey)                                                  | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `template`                 | [ActionTemplateEntity](#actiontemplateentity-action_template)                         | FK, Nullable |                                                                                                                                                                                                                                                                                                                                   |
| `image`                    | `Image`                                                                               | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `scriptObject`             | `string`                                                                              | Nullable     | Object key of the single-file Python script this action runs, inside the scripts bucket. Null for ordinary actions, which carry their code in their image. When set, the runner hands the container a presigned URL for this object through `KLEINKRAM_SCRIPT_URL`, and the shared `script-runner` image fetches and executes it. |
| `maxRuntimeHours`          | `number`                                                                              | Nullable     | Per-run runtime budget in hours, overriding the template's. Null means "use the template's `maxRuntime`". It can only lower the budget, never raise it, so a caller cannot use it to buy more runtime than the template allows.                                                                                                   |
| `worker`                   | [WorkerEntity](#workerentity-worker)                                                  | FK, Nullable |                                                                                                                                                                                                                                                                                                                                   |
| `triggerSource`            | `enum`                                                                                | Not Null     |                                                                                                                                                                                                                                                                                                                                   |
| `trigger`                  | [ActionTriggerEntity](#actiontriggerentity-action_trigger)                            | FK, Nullable |                                                                                                                                                                                                                                                                                                                                   |
| `triggerUuid`              | `string`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `errorHint`                | `enum`                                                                                | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `resourceUsage`            | `ResourceUsage`                                                                       | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `maxMemoryBytes`           | `bigint`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `avgCpuPercent`            | `number`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |
| `efficiencyScore`          | `number`                                                                              | Nullable     |                                                                                                                                                                                                                                                                                                                                   |

---

<h2 id="actionrunnerentity-action_runner">ActionRunnerEntity (action_runner)</h2>

Defined in: `action/action-runner.entity.ts`

### Columns

| Column       | Type     | Constraints | Description |
| :----------- | :------- | :---------- | :---------- |
| `hostname`   | `string` | Not Null    |             |
| `version`    | `string` | Not Null    |             |
| `gitHash`    | `string` | Not Null    |             |
| `startedAt`  | `Date`   | Not Null    |             |
| `lastSeenAt` | `Date`   | Not Null    |             |

---

<h2 id="actionstatetransitionentity-action_state_transition">ActionStateTransitionEntity (action_state_transition)</h2>

Defined in: `action/action-state-transition.entity.ts`

### Indices

| Index Definition                                                            |
| :-------------------------------------------------------------------------- |
| `@Index('idx_action_state_transition_action', ['actionUuid', 'createdAt'])` |

### Columns

| Column        | Type                                   | Constraints  | Description                                                                                                                     |
| :------------ | :------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------ |
| `uuid`        | `string`                               | Not Null     |                                                                                                                                 |
| `createdAt`   | `timestamp`                            | Not Null     |                                                                                                                                 |
| `state`       | `enum`                                 | Not Null     |                                                                                                                                 |
| `causeCode`   | `string \| null`                       | Nullable     | An `ActionStateCause`, kept as text: a newer service may write a code this one does not know yet.                               |
| `causeParams` | `jsonb`                                | Nullable     |                                                                                                                                 |
| `message`     | `text`                                 | Nullable     | The raw message if there is one, otherwise the text at write time. Shown only for codes the reader does not know; never parsed. |
| `action`      | [ActionEntity](#actionentity-action)   | FK, Nullable |                                                                                                                                 |
| `actionUuid`  | `string`                               | Not Null     |                                                                                                                                 |
| `actor`       | [UserEntity](#userentity-user) \| null | FK, Nullable | Who caused the change, e.g. who cancelled. Kept when the user is not.                                                           |
| `actorUuid`   | `string \| null`                       | Nullable     |                                                                                                                                 |

---

<h2 id="actiontemplateentity-action_template">ActionTemplateEntity (action_template)</h2>

Defined in: `action/action-template.entity.ts`

### Indices

| Index Definition                                                                                               |
| :------------------------------------------------------------------------------------------------------------- |
| `@Index('unique_versioned_action_name', ['name', 'version'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column         | Type                                   | Constraints  | Description                                                                                                                                                                                                                                                                                                                         |
| :------------- | :------------------------------------- | :----------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image_name`   | `string`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `name`         | `string`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `description`  | `string`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `creator`      | [UserEntity](#userentity-user)         | FK, Not Null |                                                                                                                                                                                                                                                                                                                                     |
| `command`      | `string`                               | Nullable     |                                                                                                                                                                                                                                                                                                                                     |
| `actions`      | [ActionEntity](#actionentity-action)[] | OneToMany    |                                                                                                                                                                                                                                                                                                                                     |
| `version`      | `number`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `isArchived`   | `boolean`                              | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `isSystem`     | `boolean`                              | Not Null     | True for templates the platform owns rather than a user. The `script-runner` template is infrastructure: every `run-script` execution points at it, so letting one person edit or delete it would break the feature for the whole deployment. System templates are seeded by migration and rejected by the update and delete paths. |
| `cpuCores`     | `number`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `cpuMemory`    | `number`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `gpuMemory`    | `number`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `maxRuntime`   | `number`                               | Not Null     |                                                                                                                                                                                                                                                                                                                                     |
| `entrypoint`   | `string`                               | Nullable     |                                                                                                                                                                                                                                                                                                                                     |
| `accessRights` | `enum`                                 | Not Null     |                                                                                                                                                                                                                                                                                                                                     |

---

<h2 id="actiontriggerentity-action_trigger">ActionTriggerEntity (action_trigger)</h2>

Defined in: `action/action-trigger.entity.ts`

### Columns

| Column         | Type                                                          | Constraints  | Description |
| :------------- | :------------------------------------------------------------ | :----------- | :---------- |
| `name`         | `string`                                                      | Not Null     |             |
| `description`  | `string`                                                      | Not Null     |             |
| `template`     | [ActionTemplateEntity](#actiontemplateentity-action_template) | FK, Not Null |             |
| `templateUuid` | `string`                                                      | Not Null     |             |
| `mission`      | [MissionEntity](#missionentity-mission)                       | FK, Not Null |             |
| `missionUuid`  | `string`                                                      | Not Null     |             |
| `type`         | `enum`                                                        | Not Null     |             |
| `config`       | `TriggerConfig`                                               | Not Null     |             |
| `creator`      | [UserEntity](#userentity-user)                                | FK, Not Null |             |
| `creatorUuid`  | `string`                                                      | Not Null     |             |

---

<h2 id="apikeyentity-apikey">ApiKeyEntity (apikey)</h2>

Defined in: `auth/api-key.entity.ts`

### Indices

| Index Definition                                                                              |
| :-------------------------------------------------------------------------------------------- |
| `@Index('unique_apikey_active', ['apikey'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column     | Type                                    | Constraints  | Description |
| :--------- | :-------------------------------------- | :----------- | :---------- |
| `apikey`   | `string`                                | Not Null     |             |
| `key_type` | `enum`                                  | Not Null     |             |
| `mission`  | [MissionEntity](#missionentity-mission) | FK, Not Null |             |
| `action`   | [ActionEntity](#actionentity-action)    | Nullable     |             |
| `user`     | [UserEntity](#userentity-user)          | FK, Nullable |             |
| `rights`   | `enum`                                  | Not Null     |             |

---

<h2 id="baseentity-baseentity">BaseEntity (BaseEntity)</h2>

Defined in: `base-entity.entity.ts`

### Indices

| Index Definition               |
| :----------------------------- |
| Column `deletedAt`: `@Index()` |

### Columns

| Column      | Type        | Constraints | Description                                                                           |
| :---------- | :---------- | :---------- | :------------------------------------------------------------------------------------ |
| `uuid`      | `uuid (PK)` | Not Null    | Unique UUID for the entity                                                            |
| `createdAt` | `timestamp` | Not Null    | Timestamp of when the entity was created                                              |
| `updatedAt` | `timestamp` | Not Null    | Timestamp of when the entity was last updated                                         |
| `deletedAt` | `Date`      | Nullable    | Timestamp of when the entity was deleted. This field is used to soft-delete entities. |

---

<h2 id="categoryentity-category">CategoryEntity (category)</h2>

Defined in: `category/category.entity.ts`

### Indices

| Index Definition                                                                                                   |
| :----------------------------------------------------------------------------------------------------------------- |
| `@Index('unique_category_name_per_project', ['name', 'project'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column        | Type                                    | Constraints  | Description                                                                                                         |
| :------------ | :-------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------ |
| `name`        | `string`                                | Not Null     |                                                                                                                     |
| `description` | `string`                                | Not Null     | Optional, human readable explanation of what the category is used for. Empty string if no description was provided. |
| `project`     | [ProjectEntity](#projectentity-project) | FK, Nullable |                                                                                                                     |
| `files`       | [FileEntity](#fileentity-file_entity)[] | ManyToMany   |                                                                                                                     |
| `creator`     | [UserEntity](#userentity-user)          | FK, Nullable |                                                                                                                     |

---

<h2 id="fileentity-file_entity">FileEntity (file_entity)</h2>

Defined in: `file/file.entity.ts`

### Indices

| Index Definition                                                                                                   |
| :----------------------------------------------------------------------------------------------------------------- |
| `@Index('unique_file_name_per_mission', ['filename', 'mission'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column                    | Type                                         | Constraints  | Description                                                                                                                                                                                                                                                                                                                                                            |
| :------------------------ | :------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mission`                 | [MissionEntity](#missionentity-mission)      | FK, Nullable |                                                                                                                                                                                                                                                                                                                                                                        |
| `date`                    | `Date`                                       | Not Null     | The date the file is sorted and filtered by. It mirrors `recordingStartDate` as soon as the recording times are known and falls back to the upload time for files we cannot extract a recording start from (e.g. configs). Use `recordingStartDate` whenever you need to know whether a date really comes from the recorded data, and `createdAt` for the upload time. |
| `recordingStartDate`      | `Date \| null`                               | Nullable     | Timestamp of the first message in the recording. `null` while unknown (not yet extracted, or not a recording at all).                                                                                                                                                                                                                                                  |
| `recordingEndDate`        | `Date \| null`                               | Nullable     | Timestamp of the last message in the recording. Together with `recordingStartDate` this gives the wall-clock length of the recording.                                                                                                                                                                                                                                  |
| `recordingTimesCheckedAt` | `Date \| null`                               | Nullable     | When the recording window of this file was last looked for, whether or not one was found. It is what lets the backfill rotate through its backlog instead of retrying the same unreadable files forever.                                                                                                                                                               |
| `topics`                  | [TopicEntity](#topicentity-topic)[]          | OneToMany    |                                                                                                                                                                                                                                                                                                                                                                        |
| `filename`                | `string`                                     | Not Null     |                                                                                                                                                                                                                                                                                                                                                                        |
| `size`                    | `bigint`                                     | Nullable     |                                                                                                                                                                                                                                                                                                                                                                        |
| `creator`                 | [UserEntity](#userentity-user)               | FK, Nullable | The user who uploaded the file.                                                                                                                                                                                                                                                                                                                                        |
| `type`                    | `enum`                                       | Not Null     |                                                                                                                                                                                                                                                                                                                                                                        |
| `state`                   | `enum`                                       | Not Null     |                                                                                                                                                                                                                                                                                                                                                                        |
| `stateComment`            | `text`                                       | Nullable     |                                                                                                                                                                                                                                                                                                                                                                        |
| `hash`                    | `string`                                     | Nullable     |                                                                                                                                                                                                                                                                                                                                                                        |
| `categories`              | [CategoryEntity](#categoryentity-category)[] | ManyToMany   |                                                                                                                                                                                                                                                                                                                                                                        |
| `parent`                  | [FileEntity](#fileentity-file_entity)        | FK, Nullable | The parent file this file was derived from. e.g., If this is a .mcap converted from a .bag, the .bag is the parent.                                                                                                                                                                                                                                                    |
| `derivedFiles`            | [FileEntity](#fileentity-file_entity)[]      | OneToMany    | Files derived from this file.                                                                                                                                                                                                                                                                                                                                          |
| `origin`                  | `enum`                                       | Nullable     |                                                                                                                                                                                                                                                                                                                                                                        |

---

<h2 id="fileevententity-file_event">FileEventEntity (file_event)</h2>

Defined in: `file/file-event.entity.ts`

### Indices

| Index Definition             |
| :--------------------------- |
| Column `mission`: `@Index()` |

### Columns

| Column             | Type                                    | Constraints  | Description                                                                                                         |
| :----------------- | :-------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------ |
| `uuid`             | `string`                                | Not Null     |                                                                                                                     |
| `createdAt`        | `timestamp`                             | Not Null     |                                                                                                                     |
| `type`             | `enum`                                  | Not Null     |                                                                                                                     |
| `details`          | `jsonb`                                 | Not Null     | JSON payload for specific details. e.g. { oldName: "foo.bag", newName: "bar.bag" } or { error: "Corrupted header" } |
| `filenameSnapshot` | `string`                                | Not Null     | Snapshot of the filename at the time of the event. Useful if the FileEntity is deleted later.                       |
| `actor`            | [UserEntity](#userentity-user)          | FK, Nullable |                                                                                                                     |
| `file`             | [FileEntity](#fileentity-file_entity)   | FK, Nullable | Relation to the file. CHANGED: onDelete set to CASCADE to delete this event if the file is deleted.                 |
| `mission`          | [MissionEntity](#missionentity-mission) | FK, Nullable | Relation to Mission. Useful for filtering logs by mission even if the file is gone.                                 |
| `action`           | [ActionEntity](#actionentity-action)    | FK, Nullable |                                                                                                                     |

---

<h2 id="groupmembershipentity-group_membership">GroupMembershipEntity (group_membership)</h2>

Defined in: `auth/group-membership.entity.ts`

### Columns

| Column           | Type                                                 | Constraints  | Description                                                                                                                                                                                                                                                          |
| :--------------- | :--------------------------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessGroup`    | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |                                                                                                                                                                                                                                                                      |
| `user`           | [UserEntity](#userentity-user)                       | FK, Nullable |                                                                                                                                                                                                                                                                      |
| `expirationDate` | `Date`                                               | Nullable     | The expiration date of the group membership. If the expiration data is set, the user will be treated as if they were not part of the group after the expiration date. If the expiration date is not set, the user will be treated as part of the group indefinitely. |
| `canEditGroup`   | `boolean`                                            | Not Null     | If the user is a group admin, they can manage the group. Group admins can add and remove users from the group.                                                                                                                                                       |

---

<h2 id="ingestionjobentity-ingestion_job">IngestionJobEntity (ingestion_job)</h2>

Defined in: `file/ingestion-job.entity.ts`

### Columns

| Column               | Type                                    | Constraints  | Description                                                                                                                                                                 |
| :------------------- | :-------------------------------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identifier`         | `string`                                | Not Null     | The unique identifier of the file. This is the Google Drive ID for files imported from Google Drive or the UUID for file entities created in the system for files uploaded. |
| `displayName`        | `string`                                | Not Null     | The name of the file as displayed to the user in the queue list                                                                                                             |
| `state`              | `enum`                                  | Not Null     |                                                                                                                                                                             |
| `mission`            | [MissionEntity](#missionentity-mission) | FK, Nullable |                                                                                                                                                                             |
| `location`           | `enum`                                  | Not Null     |                                                                                                                                                                             |
| `processingDuration` | `number`                                | Nullable     |                                                                                                                                                                             |
| `errorMessage`       | `string`                                | Nullable     | Error message if the ingestion failed.                                                                                                                                      |
| `creator`            | [UserEntity](#userentity-user)          | FK, Nullable |                                                                                                                                                                             |
| `file`               | [FileEntity](#fileentity-file_entity)   | FK, Nullable | Link to the actual FileEntity once created. This allows us to easily join Queue -> File. CHANGED: onDelete set to CASCADE to delete this job if the file is deleted.        |

---

<h2 id="metadataentity-metadata">MetadataEntity (metadata)</h2>

Defined in: `metadata/metadata.entity.ts`

### Columns

| Column           | Type                                                    | Constraints  | Description |
| :--------------- | :------------------------------------------------------ | :----------- | :---------- |
| `value_string`   | `string`                                                | Nullable     |             |
| `value_number`   | `number`                                                | Nullable     |             |
| `value_boolean`  | `boolean`                                               | Nullable     |             |
| `value_date`     | `Date`                                                  | Nullable     |             |
| `value_location` | `string`                                                | Nullable     |             |
| `mission`        | [MissionEntity](#missionentity-mission)                 | FK, Nullable |             |
| `metadataType`   | [MetadataTypeEntity](#metadatatypeentity-metadata_type) | FK, Nullable |             |
| `creator`        | [UserEntity](#userentity-user)                          | FK, Nullable |             |

---

<h2 id="metadatatypeentity-metadata_type">MetadataTypeEntity (metadata_type)</h2>

Defined in: `metadata/metadata-type.entity.ts`

### Columns

| Column        | Type                                         | Constraints | Description |
| :------------ | :------------------------------------------- | :---------- | :---------- |
| `name`        | `string`                                     | Not Null    |             |
| `description` | `string`                                     | Nullable    |             |
| `datatype`    | `enum`                                       | Not Null    |             |
| `projects`    | [ProjectEntity](#projectentity-project)[]    | ManyToMany  |             |
| `metadata`    | [MetadataEntity](#metadataentity-metadata)[] | OneToMany   |             |

---

<h2 id="missionaccessentity-mission_access">MissionAccessEntity (mission_access)</h2>

Defined in: `auth/mission-access.entity.ts`

### Columns

| Column        | Type                                                 | Constraints  | Description |
| :------------ | :--------------------------------------------------- | :----------- | :---------- |
| `rights`      | `enum`                                               | Not Null     |             |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |             |
| `mission`     | [MissionEntity](#missionentity-mission)              | FK, Nullable |             |

---

<h2 id="missionentity-mission">MissionEntity (mission)</h2>

Defined in: `mission/mission.entity.ts`

### Indices

| Index Definition                                                                                                  |
| :---------------------------------------------------------------------------------------------------------------- |
| `@Index('unique_mission_name_per_project', ['name', 'project'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column             | Type                                                         | Constraints  | Description |
| :----------------- | :----------------------------------------------------------- | :----------- | :---------- |
| `name`             | `string`                                                     | Not Null     |             |
| `project`          | [ProjectEntity](#projectentity-project)                      | FK, Nullable |             |
| `files`            | [FileEntity](#fileentity-file_entity)[]                      | OneToMany    |             |
| `actions`          | [ActionEntity](#actionentity-action)[]                       | OneToMany    |             |
| `ingestionJobs`    | [IngestionJobEntity](#ingestionjobentity-ingestion_job)[]    | OneToMany    |             |
| `creator`          | [UserEntity](#userentity-user)                               | FK, Nullable |             |
| `api_keys`         | [ApiKeyEntity](#apikeyentity-apikey)[]                       | OneToMany    |             |
| `mission_accesses` | [MissionAccessEntity](#missionaccessentity-mission_access)[] | OneToMany    |             |
| `metadata`         | [MetadataEntity](#metadataentity-metadata)[]                 | OneToMany    |             |

---

<h2 id="projectaccessentity-project_access">ProjectAccessEntity (project_access)</h2>

Defined in: `auth/project-access.entity.ts`

### Columns

| Column        | Type                                                 | Constraints  | Description |
| :------------ | :--------------------------------------------------- | :----------- | :---------- |
| `rights`      | `enum`                                               | Not Null     |             |
| `accessGroup` | [AccessGroupEntity](#accessgroupentity-access_group) | FK, Nullable |             |
| `project`     | [ProjectEntity](#projectentity-project)              | FK, Nullable |             |

---

<h2 id="projectentity-project">ProjectEntity (project)</h2>

Defined in: `project/project.entity.ts`

### Indices

| Index Definition                                                                                  |
| :------------------------------------------------------------------------------------------------ |
| `@Index('unique_project_name_active', ['name'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column                  | Type                                                         | Constraints  | Description                                                                                                                              |
| :---------------------- | :----------------------------------------------------------- | :----------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                  | `string`                                                     | Not Null     | The name of the project. This is the name that will be displayed in the UI. The name must be unique among active (non-deleted) projects. |
| `missions`              | [MissionEntity](#missionentity-mission)[]                    | OneToMany    |                                                                                                                                          |
| `project_accesses`      | [ProjectAccessEntity](#projectaccessentity-project_access)[] | OneToMany    |                                                                                                                                          |
| `description`           | `string`                                                     | Not Null     |                                                                                                                                          |
| `creator`               | [UserEntity](#userentity-user)                               | FK, Nullable |                                                                                                                                          |
| `requiredMetadataTypes` | [MetadataTypeEntity](#metadatatypeentity-metadata_type)[]    | ManyToMany   |                                                                                                                                          |
| `categories`            | [CategoryEntity](#categoryentity-category)[]                 | OneToMany    |                                                                                                                                          |
| `autoConvert`           | `boolean`                                                    | Nullable     |                                                                                                                                          |
| `stars`                 | [ProjectStarEntity](#projectstarentity-project_star)[]       | OneToMany    |                                                                                                                                          |

---

<h2 id="projectstarentity-project_star">ProjectStarEntity (project_star)</h2>

Defined in: `project/project-star.entity.ts`

### Indices

| Index Definition                                                                                               |
| :------------------------------------------------------------------------------------------------------------- |
| `@Index('unique_project_star_per_user', ['user', 'project'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column    | Type                                    | Constraints  | Description |
| :-------- | :-------------------------------------- | :----------- | :---------- |
| `user`    | [UserEntity](#userentity-user)          | FK, Nullable |             |
| `project` | [ProjectEntity](#projectentity-project) | FK, Nullable |             |

---

<h2 id="sessionentity-user_session">SessionEntity (user_session)</h2>

Defined in: `auth/session.entity.ts`

### Indices

| Index Definition                                             |
| :----------------------------------------------------------- |
| `@Index('idx_user_session_user', ['userUuid', 'revokedAt'])` |

### Columns

| Column          | Type                           | Constraints  | Description                                                                                                                                                                                                                                               |
| :-------------- | :----------------------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`          | `string`                       | Not Null     |                                                                                                                                                                                                                                                           |
| `user`          | [UserEntity](#userentity-user) | FK, Nullable |                                                                                                                                                                                                                                                           |
| `userUuid`      | `string`                       | Not Null     |                                                                                                                                                                                                                                                           |
| `kind`          | `enum`                         | Not Null     |                                                                                                                                                                                                                                                           |
| `name`          | `string \| null`               | Nullable     | Browser or host name, shown in the list of sessions.                                                                                                                                                                                                      |
| `platform`      | `string \| null`               | Nullable     | Operating system, shown in the list of sessions.                                                                                                                                                                                                          |
| `clientVersion` | `string \| null`               | Nullable     | CLI or web app version that started the session.                                                                                                                                                                                                          |
| `createdAt`     | `timestamp`                    | Not Null     |                                                                                                                                                                                                                                                           |
| `lastUsedAt`    | `Date`                         | Not Null     | Last refresh; the idle limit counts from here.                                                                                                                                                                                                            |
| `expiresAt`     | `Date`                         | Not Null     | Absolute end of the session, no matter how actively it is used.                                                                                                                                                                                           |
| `revokedAt`     | `Date \| null`                 | Nullable     |                                                                                                                                                                                                                                                           |
| `revokedReason` | `string \| null`               | Nullable     | Why the session ended early, e.g. `logout`, `user`, `reuse`.                                                                                                                                                                                              |
| `rotating`      | `boolean`                      | Not Null     | Whether refresh tokens of this session rotate. Set once the client is known to store rotated tokens (web app, CLI 0.67+) and never switched off again, so a caller cannot opt out of rotation (and its reuse detection) by sending an old client version. |
| `generation`    | `number`                       | Not Null     | Number of the current refresh token, increased on every rotation.                                                                                                                                                                                         |
| `rotatedAt`     | `Date \| null`                 | Nullable     | When the current refresh token replaced the previous one.                                                                                                                                                                                                 |
| `secret`        | `string`                       | Not Null     | Per-session input to the refresh token HMAC.                                                                                                                                                                                                              |

---

<h2 id="topicentity-topic">TopicEntity (topic)</h2>

Defined in: `topic/topic.entity.ts`

### Columns

| Column            | Type                                  | Constraints  | Description |
| :---------------- | :------------------------------------ | :----------- | :---------- |
| `name`            | `string`                              | Not Null     |             |
| `type`            | `string`                              | Not Null     |             |
| `nrMessages`      | `bigint`                              | Nullable     |             |
| `messageEncoding` | `string`                              | Not Null     |             |
| `frequency`       | `number`                              | Not Null     |             |
| `file`            | [FileEntity](#fileentity-file_entity) | FK, Nullable |             |

---

<h2 id="userentity-user">UserEntity (user)</h2>

Defined in: `user/user.entity.ts`

### Columns

| Column             | Type                                                               | Constraints | Description                                                                                                                                                                                                           |
| :----------------- | :----------------------------------------------------------------- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`             | `string`                                                           | Not Null    | The name of the user. This is the name that will be displayed in the UI. The name gets automatically extracted from the oauth provider. @example 'John Doe'                                                           |
| `email`            | `string`                                                           | Nullable    | The email of the user. This is the email that will be displayed in the UI. The email gets automatically extracted from the oauth provider. @example 'john.doe@example.com' The email is unique and cannot be changed. |
| `role`             | `enum`                                                             | Nullable    | The role of the user. The role determines what the user can do in the application. @example 'USER' @see UserRole                                                                                                      |
| `hidden`           | `boolean`                                                          | Nullable    | A hidden user is not returned in any search queries. Hidden users may still be accessed by their UUID (e.g., when listing group memberships).                                                                         |
| `avatarUrl`        | `string`                                                           | Nullable    | The avatar url of the user. This is the url of the avatar that will be displayed in the UI. The avatar url gets automatically extracted from the oauth provider. @example 'https://example.com/avatar.jpg'            |
| `account`          | [AccountEntity](#accountentity-account)                            | Nullable    |                                                                                                                                                                                                                       |
| `memberships`      | [GroupMembershipEntity](#groupmembershipentity-group_membership)[] | OneToMany   |                                                                                                                                                                                                                       |
| `projects`         | [ProjectEntity](#projectentity-project)[]                          | OneToMany   |                                                                                                                                                                                                                       |
| `starredProjects`  | [ProjectStarEntity](#projectstarentity-project_star)[]             | OneToMany   |                                                                                                                                                                                                                       |
| `missions`         | [MissionEntity](#missionentity-mission)[]                          | OneToMany   |                                                                                                                                                                                                                       |
| `files`            | [FileEntity](#fileentity-file_entity)[]                            | OneToMany   |                                                                                                                                                                                                                       |
| `queues`           | [IngestionJobEntity](#ingestionjobentity-ingestion_job)[]          | OneToMany   |                                                                                                                                                                                                                       |
| `submittedActions` | [ActionEntity](#actionentity-action)[]                             | OneToMany   |                                                                                                                                                                                                                       |
| `templates`        | [ActionTemplateEntity](#actiontemplateentity-action_template)[]    | OneToMany   |                                                                                                                                                                                                                       |
| `metadata`         | [MetadataEntity](#metadataentity-metadata)[]                       | OneToMany   |                                                                                                                                                                                                                       |
| `api_keys`         | [ApiKeyEntity](#apikeyentity-apikey)[]                             | OneToMany   |                                                                                                                                                                                                                       |
| `categories`       | [CategoryEntity](#categoryentity-category)[]                       | OneToMany   |                                                                                                                                                                                                                       |
| `triggers`         | [ActionTriggerEntity](#actiontriggerentity-action_trigger)[]       | OneToMany   |                                                                                                                                                                                                                       |

---

<h2 id="workerentity-worker">WorkerEntity (worker)</h2>

Defined in: `worker/worker.entity.ts`

### Indices

| Index Definition                                                                                             |
| :----------------------------------------------------------------------------------------------------------- |
| `@Index('unique_worker_identifier_active', ['identifier'], { where: '"deletedAt" IS NULL', unique: true, })` |

### Columns

| Column       | Type                                   | Constraints | Description |
| :----------- | :------------------------------------- | :---------- | :---------- |
| `identifier` | `string`                               | Not Null    |             |
| `hostname`   | `string`                               | Not Null    |             |
| `cpuMemory`  | `number`                               | Not Null    |             |
| `gpuModel`   | `string`                               | Nullable    |             |
| `gpuMemory`  | `number`                               | Not Null    |             |
| `cpuCores`   | `number`                               | Not Null    |             |
| `cpuModel`   | `string`                               | Not Null    |             |
| `storage`    | `number`                               | Not Null    |             |
| `lastSeen`   | `Date`                                 | Not Null    |             |
| `reachable`  | `boolean`                              | Not Null    |             |
| `actions`    | [ActionEntity](#actionentity-action)[] | OneToMany   |             |

---
