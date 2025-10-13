# Backend - AI Agent Documentation

> **Purpose**: This document provides a detailed overview of the Kleinkram backend architecture for AI agents.

## Overview

The backend is a **NestJS REST API** that serves as the main entry point for all client interactions. It handles:
- File metadata management
- Project and Mission organization
- User authentication and authorization
- Action scheduling and management
- Tag and topic queries
- Access control

**Technology Stack**: NestJS, TypeORM, PostgreSQL, Passport.js, Bull (Redis)

## Project Structure

```
backend/
├── src/
│   ├── endpoints/           # API endpoint modules
│   │   ├── action/         # Action management endpoints
│   │   ├── auth/           # Authentication endpoints
│   │   ├── category/       # Category management
│   │   ├── file/           # File operations
│   │   ├── mission/        # Mission management
│   │   ├── project/        # Project management
│   │   ├── queue/          # Queue status endpoints
│   │   ├── tag/            # Tag management
│   │   ├── topic/          # Topic queries
│   │   ├── user/           # User management
│   │   └── worker/         # Worker management
│   ├── routing/            # Middleware and guards
│   │   └── middlewares/    # Request processing middleware
│   ├── services/           # Business logic services
│   ├── types/              # TypeScript type definitions
│   ├── validation/         # Request validation decorators
│   ├── app.module.ts       # Root application module
│   ├── main.ts            # Application entry point
│   ├── serialization.ts   # Response serialization
│   ├── logger.ts          # Winston logger configuration
│   └── tracing.ts         # OpenTelemetry tracing
├── tests/                  # Jest test files
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies

Key File: backend/src/app.module.ts:29-101
```

## Architecture

### Module Structure

The backend follows NestJS module architecture with clear separation of concerns:

```
AppModule
  ├── ConfigModule (Global)
  ├── TypeOrmModule (Database)
  ├── PrometheusModule (Metrics)
  ├── ScheduleModule (Cron Jobs)
  ├── PassportModule (Auth)
  └── Feature Modules:
      ├── FileModule
      ├── ProjectModule
      ├── MissionModule
      ├── ActionModule
      ├── AuthModule
      ├── UserModule
      ├── QueueModule
      ├── TagModule
      ├── TopicModule
      ├── WorkerModule
      └── CategoryModule
```

### Middleware Pipeline

Every request goes through this middleware pipeline (in order):

1. **APIKeyResolverMiddleware** (`routing/middlewares/api-key-resolver-middleware.service.ts`)
   - Resolves user from JWT token or API key
   - Attaches user/apikey to request object
   - Handles both cookie-based and header-based auth

2. **AuditLoggerMiddleware** (`routing/middlewares/audit-logger-middleware.service.ts`)
   - Logs all API requests for auditing
   - Captures user, endpoint, method, and response time

3. **VersionCheckerMiddlewareService** (`routing/middlewares/version-checker-middleware.service.ts`)
   - Validates client version compatibility
   - Returns warning if client is outdated

Key File: backend/src/app.module.ts:91-99

## API Endpoints

### File Endpoints (`/file` or `/files`)

**Controller**: `backend/src/endpoints/file/file.controller.ts`

Key endpoints:
- `GET /file` - Query files with complex filtering
- `GET /file/filtered` - Legacy filtered file query
- `GET /file/download?uuid=<id>` - Generate download URL
- `GET /file/one?uuid=<id>` - Get single file details
- `GET /file/ofMission?uuid=<id>` - Get files in a mission
- `PUT /file/:uuid` - Update file metadata
- `POST /file/moveFiles` - Move files between missions
- `DELETE /file/:uuid` - Delete a file
- `POST /file/temporaryAccess` - Get pre-signed upload URLs
- `POST /file/cancelUpload` - Cancel an in-progress upload
- `POST /file/deleteMultiple` - Batch delete files
- `GET /file/exists?uuid=<id>` - Check if file exists
- `GET /file/storage` - Get storage statistics
- `GET /file/isUploading` - Check if user is uploading

**Service**: `backend/src/services/file.service.ts`

### Project Endpoints (`/project` or `/projects`)

**Controller**: `backend/src/endpoints/project/project.controller.ts`

Key endpoints:
- `GET /project` - List all accessible projects
- `GET /project/one?uuid=<id>` - Get project details
- `POST /project` - Create new project
- `PUT /project/:uuid` - Update project
- `DELETE /project/:uuid` - Delete project

**Service**: `backend/src/services/project.service.ts`

### Mission Endpoints (`/mission` or `/missions`)

**Controller**: `backend/src/endpoints/mission/mission.controller.ts`

Key endpoints:
- `GET /mission` - List missions (with filtering)
- `GET /mission/one?uuid=<id>` - Get mission details
- `POST /mission` - Create new mission
- `PUT /mission/:uuid` - Update mission
- `DELETE /mission/:uuid` - Delete mission
- `GET /mission/ofProject?uuid=<id>` - Get missions in a project

**Service**: `backend/src/services/mission.service.ts`

### Action Endpoints (`/action`)

**Controller**: `backend/src/endpoints/action/action.controller.ts`

Key endpoints:
- `GET /action` - List actions
- `GET /action/one?uuid=<id>` - Get action details
- `POST /action` - Submit new action
- `POST /action/cancel` - Cancel a running action
- `GET /action/ofMission?uuid=<id>` - Get actions in a mission
- `GET /action/templates` - List available action templates

**Service**: `backend/src/services/action.service.ts`

### Auth Endpoints (`/auth`)

**Controller**: `backend/src/endpoints/auth/auth.controller.ts`

Key endpoints:
- `POST /auth/login` - Login with credentials
- `POST /auth/logout` - Logout
- `GET /auth/google` - OAuth login with Google
- `GET /auth/github` - OAuth login with GitHub
- `GET /auth/me` - Get current user info
- `POST /auth/apikey` - Create new API key
- `DELETE /auth/apikey/:uuid` - Delete API key

### Tag Endpoints (`/tag`)

**Controller**: `backend/src/endpoints/tag/tag.controller.ts`

Key endpoints:
- `GET /tag` - List tags with filtering
- `GET /tag/types` - List tag types
- `POST /tag` - Create tag
- `PUT /tag/:uuid` - Update tag
- `DELETE /tag/:uuid` - Delete tag

**Service**: `backend/src/services/tag.service.ts`

### Topic Endpoints (`/topic`)

**Controller**: `backend/src/endpoints/topic/topic.controller.ts`

Key endpoints:
- `GET /topic` - Query topics
- `GET /topic/ofFile?uuid=<id>` - Get topics in a file

**Service**: `backend/src/services/topic.service.ts`

### User Endpoints (`/user`)

**Controller**: `backend/src/endpoints/user/user.controller.ts`

Key endpoints:
- `GET /user` - List users (admin only)
- `GET /user/me` - Get current user
- `PUT /user/:uuid` - Update user

**Service**: `backend/src/services/user.service.ts`

### Worker Endpoints (`/worker`)

**Controller**: `backend/src/endpoints/worker/worker.controller.ts`

Key endpoints:
- `GET /worker` - List workers
- `GET /worker/one?uuid=<id>` - Get worker details

**Service**: `backend/src/services/worker.service.ts`

### Queue Endpoints (`/queue`)

**Controller**: `backend/src/endpoints/queue/queue.controller.ts`

Key endpoints:
- `GET /queue` - List queue entries
- `GET /queue/ofMission?uuid=<id>` - Get queue entries for a mission

**Service**: `backend/src/services/queue.service.ts`

## Authentication & Authorization

### Authentication Methods

The backend supports three authentication methods:

1. **JWT Tokens** (Cookie or Header)
   - Set via `accessToken` cookie or `Authorization: Bearer <token>` header
   - Used by frontend
   - Expires after configured time

2. **API Keys** (Header)
   - Set via `x-api-key` header
   - Used by CLI and programmatic access
   - Can be scoped to specific missions
   - Types: USER (full access), CONTAINER (limited, for actions)

3. **OAuth** (GitHub, Google)
   - Handled by Passport.js strategies
   - Creates/links user accounts automatically
   - Returns JWT token after successful OAuth

### Authorization Guards

Guards are implemented as decorators in `backend/src/endpoints/auth/roles.decorator.ts`:

- `@LoggedIn()` - User must be authenticated
- `@UserOnly()` - Must be a real user (not API key)
- `@AdminOnly()` - Must be an admin user
- `@CanReadFile()` - Can read a specific file
- `@CanWriteFile()` - Can write to a specific file
- `@CanDeleteFile()` - Can delete a specific file
- `@CanReadMission()` - Can read a mission
- `@CanWriteMission()` - Can write to a mission
- `@CanDeleteMission()` - Can delete a mission
- `@CanReadProject()` - Can read a project
- `@CanWriteProject()` - Can write to a project
- `@CanCreateInMissionByBody()` - Can create resources in a mission (from body)
- `@CanMoveFiles()` - Can move files between missions

### Access Control

Access control is managed through:

1. **Project Access** (`common/entities/auth/project-access.entity`)
   - Links users/groups to projects
   - Defines read/write/admin permissions

2. **Mission Access** (`common/entities/auth/mission-access.entity`)
   - Links users/groups to missions
   - Inherits from project access

3. **Access Groups** (`common/entities/auth/accessgroup.entity`)
   - Groups of users
   - Can have expiry dates
   - Managed in `backend/src/endpoints/auth/`

**Services**:
- `backend/src/services/access.service.ts` - Access control logic
- `backend/src/services/file-guard.service.ts` - File-level permissions
- `backend/src/services/project-guard.service.ts` - Project-level permissions

## Database Schema

The backend uses TypeORM with PostgreSQL. Key entities are defined in `common/entities/`:

### Core Entities

1. **User** (`common/entities/user/user.entity.ts`)
   - id, uuid, email, username, isAdmin
   - Relations: submittedActions, apikeys, projectAccess, missionAccess

2. **Project** (`common/entities/project/project.entity.ts`)
   - id, uuid, name, description, autoConvert
   - Relations: missions, access

3. **Mission** (`common/entities/mission/mission.entity.ts`)
   - id, uuid, name, description, date
   - Relations: project, files, actions, queues, access

4. **File** (`common/entities/file/file.entity.ts`)
   - id, uuid, filename, size, hash, type, state, origin
   - Relations: mission, creator, topics, tags, relatedFile

5. **Topic** (`common/entities/topic/topic.entity.ts`)
   - id, uuid, name, type, messageCount, frequency
   - Relations: file

6. **Action** (`common/entities/action/action.entity.ts`)
   - id, uuid, state, exitCode, logs, artifacts
   - Relations: mission, template, createdBy, worker

7. **ActionTemplate** (`common/entities/action/action-template.entity.ts`)
   - id, uuid, name, version, imageName, command
   - Runtime requirements: cpuCores, cpuMemory, gpuMemory, maxRuntime

8. **QueueEntity** (`common/entities/queue/queue.entity.ts`)
   - id, uuid, state, location, identifier, displayName
   - Relations: mission, creator

9. **Tag** (`common/entities/tag/tag.entity.ts`)
   - id, uuid, value
   - Relations: file, type

10. **Worker** (`common/entities/worker/worker.entity.ts`)
    - id, uuid, hostname, identifier, reachable, storage
    - Relations: actions

### Database Operations

- **Synchronize**: Enabled in DEV mode (auto-creates/updates schema)
- **Migrations**: Not currently used (relies on synchronize)
- **Transactions**: Used for atomic operations
- **Query Builder**: Used for complex queries with joins

## Services Layer

Services contain the business logic and are injected into controllers.

### Key Services

1. **FileService** (`backend/src/services/file.service.ts`)
   - File CRUD operations
   - Pre-signed URL generation (MinIO)
   - File filtering and search
   - Upload cancellation
   - Storage statistics

2. **ProjectService** (`backend/src/services/project.service.ts`)
   - Project CRUD operations
   - Access control integration

3. **MissionService** (`backend/src/services/mission.service.ts`)
   - Mission CRUD operations
   - Filtering and pagination

4. **ActionService** (`backend/src/services/action.service.ts`)
   - Action submission
   - Worker assignment
   - Action cancellation
   - Template management

5. **AuthService** (`backend/src/services/auth.service.ts`)
   - JWT token generation/validation
   - API key management
   - OAuth integration

6. **QueueService** (`backend/src/services/queue.service.ts`)
   - Queue entry creation
   - Job submission to Redis (Bull)
   - Queue status queries

7. **AccessService** (`backend/src/services/access.service.ts`)
   - Permission checking
   - Access group management

8. **FileGuardService** (`backend/src/services/file-guard.service.ts`)
   - File-level permission checking
   - Used by guards

9. **ProjectGuardService** (`backend/src/services/project-guard.service.ts`)
   - Project-level permission checking
   - Used by guards

## Validation & Serialization

### Request Validation

Custom decorators in `backend/src/validation/`:

**Query Parameters**:
- `@QueryUUID()` - UUID validation
- `@QueryString()` - String parameter
- `@QueryBoolean()` - Boolean parameter
- `@QueryOptionalString()` - Optional string
- `@QueryOptionalDate()` - Optional date
- `@QuerySkip()` - Pagination offset
- `@QueryTake()` - Pagination limit
- `@QuerySortBy()` - Sort field
- `@QuerySortDirection()` - Sort direction

**Body Parameters**:
- `@BodyUUID()` - UUID in body
- `@BodyUUIDArray()` - Array of UUIDs

**Path Parameters**:
- `@ParameterUuid()` - UUID in path

### Response Serialization

Responses are serialized using `class-transformer` in `backend/src/serialization.ts`:
- Removes sensitive fields
- Transforms entities to DTOs
- Handles nested relations

Key File: backend/src/serialization.ts:1-288

### DTOs

Data Transfer Objects are defined in `common/api/types/`:
- Request validation
- Response typing
- Shared between backend and frontend

## Queue Integration

The backend enqueues jobs to Redis using Bull:

```typescript
// Example: Enqueue file processing job
await this.fileQueue.add('processMinioFile', {
  queueUuid: queue.uuid,
  md5: fileMd5Hash,
});
```

Queue types:
- `file-queue` - File processing jobs
- `action-queue-{hostname}` - Action execution jobs (per worker)
- `file-cleanup` - File deletion jobs
- `move` - File move operations

The Queue Consumer picks up these jobs and processes them.

## MinIO Integration

MinIO is used for object storage (S3-compatible):

**Configuration**:
- `MINIO_ENDPOINT` - MinIO server endpoint
- `MINIO_ACCESS_KEY` - Access key
- `MINIO_SECRET_KEY` - Secret key
- `MINIO_BAG_BUCKET_NAME` - Bucket for bag files
- `MINIO_MCAP_BUCKET_NAME` - Bucket for mcap files

**Operations**:
- Pre-signed URLs for upload/download
- Object tagging (missionUuid, projectUuid, filename)
- Bucket listing
- Object deletion

Helper functions in `common/minio-helper.ts`

## Observability

### Logging

Winston logger with Loki integration:
- `backend/src/logger.ts`
- Structured logging with labels
- Log levels: debug, info, warn, error
- Logs sent to Loki (if configured)

### Tracing

OpenTelemetry integration:
- `backend/src/tracing.ts`
- Automatic instrumentation for HTTP, DB, etc.
- Custom spans with `@tracing()` decorator
- Traces exported to OTLP endpoint

### Metrics

Prometheus metrics:
- Endpoint metrics (requests, duration, errors)
- Custom metrics via `@willsoto/nestjs-prometheus`
- Available at `/metrics` endpoint

## Scheduled Jobs

NestJS Schedule module is used for cron jobs:

**DBDumper** (`backend/src/services/dbdumper.service.ts`):
- Scheduled database backups
- Cron expression configurable

## Environment Configuration

Configuration loaded from:
1. `.env` file (root)
2. Environment variables
3. `common/environment.ts` - Default values

Key environment variables:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, etc. - Database config
- `MINIO_*` - MinIO configuration
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - OAuth
- `ENDPOINT` - Backend URL
- `DEV` - Development mode flag

## Error Handling

- Global exception filter (NestJS built-in)
- Custom error classes in `common/`
- HTTP status codes used appropriately
- Detailed error messages in development
- Sanitized errors in production

## Testing

Tests are in `backend/tests/`:
- Unit tests for services
- Integration tests for endpoints
- E2E tests (require full stack)

Run tests:
```bash
yarn test
```

## Common Development Tasks

### Adding a New Endpoint

1. Create module in `backend/src/endpoints/<name>/`
2. Create controller, service, module files
3. Define DTOs in `common/api/types/`
4. Add guards for authorization
5. Register module in `app.module.ts`
6. Add tests

### Adding Database Field

1. Update entity in `common/entities/`
2. Synchronize will auto-update in DEV
3. For production, create migration

### Adding Permission Check

1. Use existing guards or create new guard
2. Implement logic in AccessService or create specialized service
3. Apply guard decorator to endpoint

### Debugging

1. Use `logger.debug()` for detailed logs
2. Check OpenTelemetry traces
3. Use NestJS debug mode: `yarn start:debug`
4. Attach debugger to port 9229

## Related Documentation

- [Root AGENTS.md](../AGENTS.md) - System overview
- [Common AGENTS.md](../common/AGENTS.md) - Shared entities and DTOs
- [Queue Consumer AGENTS.md](../queueConsumer/AGENTS.md) - Job processing
