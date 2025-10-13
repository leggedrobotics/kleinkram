# Common - AI Agent Documentation

> **Purpose**: This document provides a detailed overview of the Kleinkram common module for AI agents.

## Overview

The common module is a **shared TypeScript library** used by backend, queueConsumer, and frontend. It provides a single source of truth for:
- Database entity definitions (TypeORM)
- API request/response DTOs
- Validation decorators
- Shared enums and constants
- Utility functions
- Environment configuration

**Key Responsibilities**:
- Type safety across the entire stack
- Consistent data structures
- Validation rules
- Database schema definitions (via TypeORM entities)

**Technology Stack**: TypeScript, TypeORM, class-validator, class-transformer

## Project Structure

```
common/
├── api/                        # API contracts
│   └── types/                 # DTOs for API requests/responses
│       ├── access-control/    # Access control DTOs
│       ├── actions/           # Action DTOs
│       ├── exceptions/        # Error DTOs
│       ├── file/              # File DTOs
│       ├── mission/           # Mission DTOs
│       ├── project/           # Project DTOs
│       ├── queue/             # Queue DTOs
│       ├── tags/              # Tag DTOs
│       ├── *.dto.ts           # Misc DTOs
│       └── pagination.ts      # Pagination types
├── entities/                   # TypeORM database entities
│   ├── action/                # Action entities
│   │   ├── action.entity.ts
│   │   ├── action-template.entity.ts
│   │   └── docker-resource.entity.ts
│   ├── auth/                  # Authentication & authorization entities
│   │   ├── accessgroup.entity.ts
│   │   ├── api-key.entity.ts
│   │   ├── group-membership.entity.ts
│   │   ├── mission-access.entity.ts
│   │   └── project-access.entity.ts
│   ├── category/              # Category entities
│   ├── file/                  # File entities
│   │   └── file.entity.ts
│   ├── mission/               # Mission entities
│   │   └── mission.entity.ts
│   ├── project/               # Project entities
│   │   └── project.entity.ts
│   ├── queue/                 # Queue entities
│   │   └── queue.entity.ts
│   ├── tag/                   # Tag entities
│   │   ├── tag.entity.ts
│   │   └── tag-type.entity.ts
│   ├── topic/                 # Topic entities
│   │   └── topic.entity.ts
│   ├── user/                  # User entities
│   │   └── user.entity.ts
│   ├── worker/                # Worker entities
│   │   └── worker.entity.ts
│   └── base-entity.entity.ts  # Base entity class
├── frontend_shared/           # Shared frontend code
│   └── enum.ts               # Enums
├── helpers/                   # Utility functions
├── viewEntities/              # Database views
│   ├── mission-access-view.entity.ts
│   └── project-access-view.entity.ts
├── consts.ts                  # Constants
├── environment.ts             # Environment configuration
├── minio-helper.ts            # MinIO utilities
├── seeds/                     # Database seeds
├── package.json
└── tsconfig.json

Key File: common/entities/
Key File: common/api/types/
```

## Core Entities

### Base Entity

All entities extend `BaseEntity`:

```typescript
@Entity()
export class BaseEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid', unique: true })
  @Generated('uuid')
  uuid!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;
}
```

**Fields**:
- `id`: Auto-incrementing primary key (internal use)
- `uuid`: Universally unique identifier (public facing)
- `createdAt`: Timestamp of creation
- `updatedAt`: Timestamp of last update
- `deletedAt`: Soft delete timestamp (null if not deleted)

Key File: common/entities/base-entity.entity.ts

### File Entity

**Location**: `common/entities/file/file.entity.ts`

```typescript
@Entity({ name: 'file' })
export default class FileEntity extends BaseEntity {
  @Column()
  name!: string;  // Original filename

  @Column()
  filename!: string;  // Display filename

  @Column({ nullable: true })
  hash?: string | null;  // MD5 hash (base64)

  @Column({ type: 'bigint' })
  size!: number;  // Size in bytes

  @Column({ type: 'enum', enum: FileType })
  type!: FileType;  // BAG or MCAP

  @Column({ type: 'enum', enum: FileState })
  state!: FileState;  // UPLOADING, OK, ERROR, etc.

  @Column({ type: 'enum', enum: FileOrigin })
  origin!: FileOrigin;  // API, GOOGLE_DRIVE, UNKNOWN

  @Column({ nullable: true })
  date?: Date | null;  // Recording date

  @ManyToOne(() => Mission)
  mission!: Relation<Mission>;

  @ManyToOne(() => User)
  creator!: Relation<User>;

  @OneToMany(() => Topic, (topic) => topic.file)
  topics!: Relation<Topic[]>;

  @OneToMany(() => Tag, (tag) => tag.file)
  tags!: Relation<Tag[]>;

  @OneToOne(() => FileEntity, { nullable: true })
  @JoinColumn()
  relatedFile?: Relation<FileEntity> | null;  // bag ↔ mcap link
}
```

**Key Relations**:
- `mission`: Many files belong to one mission
- `creator`: Many files created by one user
- `topics`: One file has many topics
- `tags`: One file has many tags
- `relatedFile`: One-to-one (bag ↔ mcap)

### Mission Entity

**Location**: `common/entities/mission/mission.entity.ts`

```typescript
@Entity({ name: 'mission' })
export default class Mission extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string | null;

  @Column({ nullable: true })
  date?: Date | null;  // Recording date

  @ManyToOne(() => Project)
  project!: Relation<Project>;

  @ManyToOne(() => Category, { nullable: true })
  category?: Relation<Category> | null;

  @OneToMany(() => FileEntity, (file) => file.mission)
  files!: Relation<FileEntity[]>;

  @OneToMany(() => Action, (action) => action.mission)
  actions!: Relation<Action[]>;

  @OneToMany(() => QueueEntity, (queue) => queue.mission)
  queues!: Relation<QueueEntity[]>;

  @OneToMany(() => MissionAccess, (access) => access.mission)
  access!: Relation<MissionAccess[]>;

  // Metadata (custom JSON fields)
  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, string>;
}
```

### Project Entity

**Location**: `common/entities/project/project.entity.ts`

```typescript
@Entity({ name: 'project' })
export default class Project extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string | null;

  @Column({ default: true })
  autoConvert!: boolean;  // Auto-convert bag → mcap

  @OneToMany(() => Mission, (mission) => mission.project)
  missions!: Relation<Mission[]>;

  @OneToMany(() => ProjectAccess, (access) => access.project)
  access!: Relation<ProjectAccess[]>;

  @ManyToMany(() => TagType)
  @JoinTable()
  requiredTags!: Relation<TagType[]>;

  @ManyToMany(() => Category)
  @JoinTable()
  categories!: Relation<Category[]>;
}
```

### Action Entity

**Location**: `common/entities/action/action.entity.ts`

```typescript
@Entity({ name: 'action' })
export default class Action extends BaseEntity {
  @Column({ type: 'enum', enum: ActionState })
  state!: ActionState;  // PENDING, PROCESSING, DONE, FAILED, CANCELLED

  @Column({ nullable: true })
  stateCause?: string | null;  // Error message

  @Column({ type: 'jsonb', default: [] })
  logs!: ContainerLog[];  // Container logs

  @Column({ nullable: true })
  exitCode?: number | null;

  @Column({ nullable: true })
  artifacts?: string | null;  // Google Drive URL

  @ManyToOne(() => Mission)
  mission!: Relation<Mission>;

  @ManyToOne(() => ActionTemplate)
  template!: Relation<ActionTemplate>;

  @ManyToOne(() => User)
  createdBy!: Relation<User>;

  @ManyToOne(() => Worker, { nullable: true })
  worker?: Relation<Worker> | null;

  @Column({ type: 'simple-json', nullable: true })
  resources?: DockerResourceEntity | null;  // CPU, memory, GPU requirements
}
```

### User Entity

**Location**: `common/entities/user/user.entity.ts`

```typescript
@Entity({ name: 'user' })
export default class User extends BaseEntity {
  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  username?: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;  // ADMIN or USER

  @OneToMany(() => Action, (action) => action.createdBy)
  submittedActions!: Relation<Action[]>;

  @OneToMany(() => ApiKey, (apikey) => apikey.user)
  apikeys!: Relation<ApiKey[]>;

  @OneToMany(() => ProjectAccess, (access) => access.user)
  projectAccess!: Relation<ProjectAccess[]>;

  @OneToMany(() => MissionAccess, (access) => access.user)
  missionAccess!: Relation<MissionAccess[]>;

  @ManyToMany(() => AccessGroup, (group) => group.members)
  groups!: Relation<AccessGroup[]>;
}
```

### Topic Entity

**Location**: `common/entities/topic/topic.entity.ts`

```typescript
@Entity({ name: 'topic' })
export default class Topic extends BaseEntity {
  @Column()
  name!: string;  // e.g., /camera/image_raw

  @Column()
  type!: string;  // e.g., sensor_msgs/Image

  @Column({ type: 'bigint' })
  nrMessages!: bigint;

  @Column({ type: 'float' })
  frequency!: number;  // Hz

  @Column()
  messageEncoding!: string;  // e.g., cdr

  @ManyToOne(() => FileEntity)
  file!: Relation<FileEntity>;
}
```

### Queue Entity

**Location**: `common/entities/queue/queue.entity.ts`

```typescript
@Entity({ name: 'queue' })
export default class QueueEntity extends BaseEntity {
  @Column()
  display_name!: string;  // User-facing name

  @Column()
  identifier!: string;  // Internal identifier (file UUID or Drive ID)

  @Column({ type: 'enum', enum: QueueState })
  state!: QueueState;  // AWAITING_UPLOAD, AWAITING_PROCESSING, PROCESSING, COMPLETED, ERROR, etc.

  @Column({ type: 'enum', enum: FileLocation })
  location!: FileLocation;  // MINIO, GOOGLE_DRIVE, UNKNOWN

  @ManyToOne(() => Mission)
  mission!: Relation<Mission>;

  @ManyToOne(() => User)
  creator!: Relation<User>;
}
```

### Worker Entity

**Location**: `common/entities/worker/worker.entity.ts`

```typescript
@Entity({ name: 'worker' })
export default class Worker extends BaseEntity {
  @Column()
  hostname!: string;  // Docker hostname

  @Column()
  identifier!: string;  // Unique machine identifier

  @Column()
  cpuCores!: number;

  @Column()
  cpuMemory!: number;  // GB

  @Column()
  cpuModel!: string;

  @Column({ nullable: true })
  gpuModel?: string | null;

  @Column()
  gpuMemory!: number;  // GB (-1 if no GPU)

  @Column()
  storage!: number;  // GB

  @Column()
  reachable!: boolean;

  @Column()
  lastSeen!: Date;

  @OneToMany(() => Action, (action) => action.worker)
  actions!: Relation<Action[]>;
}
```

### Access Control Entities

#### Access Group

**Location**: `common/entities/auth/accessgroup.entity.ts`

```typescript
@Entity({ name: 'accessgroup' })
export default class AccessGroup extends BaseEntity {
  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string | null;

  @ManyToMany(() => User, (user) => user.groups)
  @JoinTable()
  members!: Relation<User[]>;

  @OneToMany(() => GroupMembership, (membership) => membership.group)
  memberships!: Relation<GroupMembership[]>;

  @OneToMany(() => ProjectAccess, (access) => access.group)
  projectAccess!: Relation<ProjectAccess[]>;

  @OneToMany(() => MissionAccess, (access) => access.group)
  missionAccess!: Relation<MissionAccess[]>;
}
```

#### Project Access

**Location**: `common/entities/auth/project-access.entity.ts`

```typescript
@Entity({ name: 'project_access' })
export default class ProjectAccess extends BaseEntity {
  @ManyToOne(() => Project)
  project!: Relation<Project>;

  @ManyToOne(() => User, { nullable: true })
  user?: Relation<User> | null;

  @ManyToOne(() => AccessGroup, { nullable: true })
  group?: Relation<AccessGroup> | null;

  @Column({ type: 'enum', enum: AccessGroupRights })
  rights!: AccessGroupRights;  // NONE, READ, WRITE, ADMIN
}
```

**Note**: Either `user` OR `group` is set, never both.

#### Mission Access

Similar to ProjectAccess, but for mission-level permissions.

**Location**: `common/entities/auth/mission-access.entity.ts`

## Enums

**Location**: `common/frontend_shared/enum.ts`

### FileState
```typescript
enum FileState {
  UPLOADING = 'UPLOADING',
  OK = 'OK',
  ERROR = 'ERROR',
  LOST = 'LOST',
  FOUND = 'FOUND',
  CONVERSION_ERROR = 'CONVERSION_ERROR',
}
```

### FileType
```typescript
enum FileType {
  BAG = 'BAG',
  MCAP = 'MCAP',
}
```

### FileOrigin
```typescript
enum FileOrigin {
  API = 'API',
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  UNKNOWN = 'UNKNOWN',
}
```

### QueueState
```typescript
enum QueueState {
  AWAITING_UPLOAD = 'AWAITING_UPLOAD',
  AWAITING_PROCESSING = 'AWAITING_PROCESSING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELED = 'CANCELED',
  CORRUPTED = 'CORRUPTED',
}
```

### ActionState
```typescript
enum ActionState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
```

### AccessGroupRights
```typescript
enum AccessGroupRights {
  NONE = 0,
  READ = 1,
  WRITE = 2,
  ADMIN = 3,
}
```

### UserRole
```typescript
enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}
```

Key File: common/frontend_shared/enum.ts

## API DTOs

**Location**: `common/api/types/`

DTOs define request and response formats for API endpoints. They use `class-validator` decorators for validation.

### File DTOs

**Location**: `common/api/types/file/`

- **FileDto**: Basic file information
- **FileWithTopicDto**: File with topics included
- **UpdateFileDto**: File update request
- **FileQueryDto**: File query parameters

### Mission DTOs

**Location**: `common/api/types/mission/`

- **MissionDto**: Full mission data
- **FlatMissionDto**: Mission without nested data
- **CreateMissionDto**: Mission creation request
- **UpdateMissionDto**: Mission update request

### Project DTOs

**Location**: `common/api/types/project/`

- **ProjectDto**: Full project data
- **CreateProjectDto**: Project creation request
- **UpdateProjectDto**: Project update request

### Action DTOs

**Location**: `common/api/types/actions/`

- **ActionDto**: Full action data
- **SubmitActionDto**: Action submission request
- **ActionWorkerDto**: Worker information for actions

### Pagination

**Location**: `common/api/types/pagination.ts`

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}
```

## Environment Configuration

**Location**: `common/environment.ts`

Provides type-safe access to environment variables:

```typescript
export default {
  // Database
  DB_DATABASE: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_PORT: number;
  DB_HOST: string;

  // MinIO
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_MCAP_BUCKET_NAME: string;
  MINIO_BAG_BUCKET_NAME: string;
  MINIO_ENDPOINT: string;

  // OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;

  // JWT
  JWT_SECRET: string;

  // App
  DEV: boolean;
  SERVER_PORT: number;
  BASE_URL: string;
  ENDPOINT: string;
  FRONTEND_URL: string;

  // Google Drive
  GOOGLE_ARTIFACT_FOLDER_ID: string;
  GOOGLE_ARTIFACT_UPLOADER_KEY_FILE: string;
  ARTIFACTS_UPLOADER_IMAGE: string;
}
```

**Validation**: Throws error if required variables are missing or invalid type.

Key File: common/environment.ts:1-194

## MinIO Helper

**Location**: `common/minio-helper.ts`

Provides utilities for MinIO operations:

```typescript
// Get MinIO client (internal or external)
export const internalMinio: Client;
export const externalMinio: Client;

// Get bucket name from file type
export function getBucketFromFileType(type: FileType): string;

// Other helpers
export function getMinioEndpoint(): string;
```

## Constants

**Location**: `common/consts.ts`

```typescript
// System user (for automated operations)
export const systemUser = {
  uuid: '00000000-0000-0000-0000-000000000000',
  email: 'system@kleinkram.local',
  username: 'system',
};

// Redis configuration
export const redis = {
  host: 'redis',
  port: 6379,
};
```

## Database Views

### Mission Access View

**Location**: `common/viewEntities/mission-access-view.entity.ts`

Materialized view for efficient access control checks:

```typescript
@ViewEntity({
  expression: `
    SELECT DISTINCT
      ma.missionUUID,
      u.uuid AS userUUID,
      MAX(ma.rights) AS rights
    FROM mission_access_view ma
    JOIN user u ON u.uuid = ma.userUUID
    GROUP BY ma.missionUUID, u.uuid
  `,
})
export class MissionAccessViewEntity {
  @ViewColumn()
  missionUUID!: string;

  @ViewColumn()
  userUUID!: string;

  @ViewColumn()
  rights!: AccessGroupRights;
}
```

Combines user-level and group-level access into a single view.

### Project Access View

Similar to MissionAccessView, but for projects.

**Location**: `common/viewEntities/project-access-view.entity.ts`

## Common Development Tasks

### Adding a New Entity

1. Create entity file in `common/entities/{category}/`
2. Extend `BaseEntity`
3. Add decorators:
   ```typescript
   @Entity({ name: 'my_entity' })
   export default class MyEntity extends BaseEntity {
     @Column()
     name!: string;

     @ManyToOne(() => OtherEntity)
     other!: Relation<OtherEntity>;
   }
   ```
4. Export from `index.ts`
5. Run migrations (if needed)

### Adding a New DTO

1. Create DTO file in `common/api/types/{category}/`
2. Add validation decorators:
   ```typescript
   export class CreateMyEntityDto {
     @IsString()
     @IsNotEmpty()
     name!: string;

     @IsUUID()
     otherEntityUuid!: string;
   }
   ```
3. Export from `index.ts`

### Adding a New Enum

1. Add to `common/frontend_shared/enum.ts`:
   ```typescript
   export enum MyEnum {
     VALUE_1 = 'VALUE_1',
     VALUE_2 = 'VALUE_2',
   }
   ```
2. Use in entities and DTOs

### Adding Environment Variable

1. Add to `common/environment.ts`:
   ```typescript
   get MY_VAR(): string {
     return asString(process.env['MY_VAR']);
   }
   ```
2. Add to `.env` file
3. Update docker-compose if needed

## Validation

Uses `class-validator` decorators:

```typescript
@IsString()
@IsNotEmpty()
@MinLength(3)
@MaxLength(50)
name!: string;

@IsUUID('4')
uuid!: string;

@IsEmail()
email!: string;

@IsEnum(FileType)
type!: FileType;

@IsOptional()
@IsString()
description?: string;
```

## Serialization

Uses `class-transformer` for:
- Excluding sensitive fields (`@Exclude()`)
- Transforming dates (`@Type(() => Date)`)
- Custom serialization (`@Transform()`)

## Database Migrations

TypeORM migrations (not currently used, relies on synchronize in DEV):

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run

# Revert migration
npm run typeorm migration:revert
```

## Testing

Common module is tested indirectly through backend and queueConsumer tests.

## Related Documentation

- [Root AGENTS.md](../AGENTS.md) - System overview
- [Backend AGENTS.md](../backend/AGENTS.md) - Backend usage
- [Queue Consumer AGENTS.md](../queueConsumer/AGENTS.md) - Queue consumer usage
- [Frontend AGENTS.md](../frontend/AGENTS.md) - Frontend usage

## Important Notes

- **Entity Relations**: Always use `Relation<T>` type for relations
- **UUID**: Use UUID as public identifier, never expose internal `id`
- **Soft Deletes**: All entities support soft delete via `deletedAt`
- **Timestamps**: `createdAt` and `updatedAt` are automatic
- **Validation**: DTOs must have validation decorators
- **Enums**: Use string enums for database storage
- **BigInt**: Use for large numbers (topic message counts, file sizes)

## TypeORM Patterns

### Lazy vs Eager Loading

```typescript
// Lazy loading (default)
const file = await fileRepository.findOne({ where: { uuid } });
const mission = await file.mission;  // Loads on access

// Eager loading
const file = await fileRepository.findOne({
  where: { uuid },
  relations: ['mission', 'mission.project'],
});
```

### Query Builder

```typescript
const files = await fileRepository
  .createQueryBuilder('file')
  .leftJoinAndSelect('file.mission', 'mission')
  .leftJoinAndSelect('mission.project', 'project')
  .where('project.name = :name', { name: 'ANYmal' })
  .andWhere('file.state = :state', { state: FileState.OK })
  .orderBy('file.createdAt', 'DESC')
  .take(50)
  .getMany();
```

### Transactions

```typescript
await dataSource.transaction(async (manager) => {
  const file = await manager.save(FileEntity, newFile);
  const queue = await manager.save(QueueEntity, newQueue);
  return { file, queue };
});
```

## Performance Considerations

- **Relations**: Load only necessary relations
- **Pagination**: Always paginate large queries
- **Indexes**: Add indexes for frequently queried columns
- **Views**: Use database views for complex access control queries
- **Caching**: Consider caching frequently accessed data

## Security

- **Validation**: All DTOs validated on API boundary
- **Soft Deletes**: Prevent accidental data loss
- **Access Control**: Views optimize permission checks
- **Enums**: Prevent invalid state values
