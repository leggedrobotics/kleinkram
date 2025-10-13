# Kleinkram - AI Agent Documentation

> **Purpose**: This document helps AI agents understand the Kleinkram codebase structure, architecture, and key concepts to work effectively with the system.

## System Overview

Kleinkram is a **structured bag and mcap file storage solution** for ROS1 and ROS2, developed by the Robotic Systems Lab (RSL) at ETH Zurich. It provides a complete platform for uploading, storing, processing, and managing robotics dataset files.

## Architecture Diagram

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
       ├──────────────────────────────────────────┐
       │                                          │
┌──────▼──────┐                          ┌───────▼────────┐
│  Frontend   │                          │      CLI       │
│  (Vue 3)    │                          │   (Python)     │
└──────┬──────┘                          └───────┬────────┘
       │                                         │
       └──────────────────┬──────────────────────┘
                          │
                   ┌──────▼──────┐
                   │   Backend   │
                   │  (NestJS)   │
                   └──────┬──────┘
                          │
       ┏━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━┓
       ┃                                      ┃
┌──────▼──────┐                      ┌────────▼────────┐
│ PostgreSQL  │                      │  Queue Consumer │
│  Database   │                      │    (NestJS)     │
└─────────────┘                      └────────┬────────┘
                                              │
                        ┏━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━┓
                        ┃                                    ┃
                 ┌──────▼──────┐                    ┌───────▼────────┐
                 │    MinIO    │                    │     Docker     │
                 │  (S3 Store) │                    │  (Actions)     │
                 └──────┬──────┘                    └───────┬────────┘
                        │                                   │
                        └──────────┬────────────────────────┘
                                   │
                            ┌──────▼──────┐
                            │ Google Drive│
                            │ (Artifacts) │
                            └─────────────┘
```

## Core Components

### 1. Backend (`/backend/`)
- **Technology**: NestJS, TypeORM, PostgreSQL
- **Purpose**: Main REST API server
- **Key Responsibilities**:
  - File metadata management
  - Project/Mission organization
  - Authentication & authorization (JWT, API keys, OAuth)
  - Action scheduling
  - Queue management
  - Tag and topic management

📖 [Detailed Backend Documentation](./backend/AGENTS.md)

### 2. Queue Consumer (`/queueConsumer/`)
- **Technology**: NestJS, Bull, Redis, Docker
- **Purpose**: Background job processor
- **Key Responsibilities**:
  - File processing (bag→mcap conversion, topic extraction)
  - Action execution (Docker container orchestration)
  - File cleanup
  - Access group expiry management

📖 [Detailed Queue Consumer Documentation](./queueConsumer/AGENTS.md)

### 3. Frontend (`/frontend/`)
- **Technology**: Vue 3, Quasar, TypeScript
- **Purpose**: Web user interface
- **Key Responsibilities**:
  - Project/Mission/File browsing
  - File upload interface
  - Action submission and monitoring
  - Access control management
  - Data visualization

📖 [Detailed Frontend Documentation](./frontend/AGENTS.md)

### 4. CLI (`/cli/`)
- **Technology**: Python
- **Purpose**: Command-line interface
- **Key Responsibilities**:
  - File upload/download
  - Project/Mission listing
  - Batch operations
  - CI/CD integration

📖 [Detailed CLI Documentation](./cli/AGENTS.md)

### 5. Common (`/common/`)
- **Technology**: TypeScript
- **Purpose**: Shared code library
- **Key Responsibilities**:
  - Entity definitions (TypeORM)
  - API DTOs and validation
  - Shared utilities and helpers
  - Environment configuration

📖 [Detailed Common Documentation](./common/AGENTS.md)

## Key Concepts

### Data Model Hierarchy

```
Project (e.g., "ANYmal Experiments")
  └── Mission (e.g., "2024-01-15_outdoor_navigation")
       └── File (e.g., "run_001.bag", "run_001.mcap")
            └── Topic (e.g., "/camera/image_raw", "/imu/data")
```

### Core Entities

1. **Project**: Top-level organizational unit, typically representing a research project or robot
2. **Mission**: A collection of related files, typically from a single recording session or experiment
3. **File**: A bag or mcap file containing ROS data
4. **Topic**: ROS topics extracted from mcap files, with metadata (type, message count, etc.)
5. **Action**: A Docker container-based processing job that operates on mission data
6. **Tag**: Custom key-value metadata attached to files
7. **User**: System users with access permissions
8. **Access Group**: Groups of users with specific permissions on projects/missions
9. **Worker**: A machine capable of executing actions
10. **Queue**: Job queue entries for file processing or action execution

### File Types

- **BAG** (`.bag`): ROS1 bag files
- **MCAP** (`.mcap`): MCAP files (ROS2 compatible, more efficient)

**Note**: The system automatically converts uploaded bag files to mcap format for efficient processing and storage.

## Data Flows

### 1. File Upload Flow

```
User → Upload (CLI/Frontend)
  → Backend creates QueueEntity
    → File stored in MinIO
      → Queue Consumer processes file
        → Convert bag → mcap (if needed)
          → Extract topics and metadata
            → Store metadata in PostgreSQL
              → File ready for use
```

Key files:
- Backend: `backend/src/endpoints/file/file.controller.ts:temporaryAccess`
- Queue Consumer: `queueConsumer/src/files/file-queue-processor.provider.ts`
- Conversion: `queueConsumer/src/files/helper/converter.ts`

### 2. Action Execution Flow

```
User → Submit Action (Frontend)
  → Backend creates Action entity
    → Action queued in Redis (Bull)
      → Worker picks up action
        → Create Docker container with resources
          → Container accesses files via API
            → Container produces artifacts
              → Artifacts uploaded to Google Drive
                → Action marked complete
```

Key files:
- Backend: `backend/src/endpoints/action/action.controller.ts`
- Queue Consumer: `queueConsumer/src/actions/action-queue-processor.provider.ts`
- Action Manager: `queueConsumer/src/actions/services/action-manager.service.ts`
- Docker Daemon: `queueConsumer/src/actions/services/docker-daemon.service.ts`

### 3. File Download Flow

```
User → Request Download (CLI/Frontend)
  → Backend validates permissions
    → Generate pre-signed MinIO URL
      → User downloads directly from MinIO
```

Key files:
- Backend: `backend/src/endpoints/file/file.controller.ts:download`
- File Service: `backend/src/services/file.service.ts:generateDownload`

## Technology Stack

### Backend/Queue Consumer
- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Queue**: Redis + Bull
- **Storage**: MinIO (S3-compatible)
- **Container Runtime**: Docker/Dockerode
- **Observability**: OpenTelemetry, Prometheus, Loki

### Frontend
- **Framework**: Vue 3
- **UI Library**: Quasar
- **HTTP Client**: Axios
- **State Management**: Tanstack Query (Vue Query)
- **Charts**: ECharts

### CLI
- **Language**: Python 3.8+
- **HTTP Client**: requests (likely)
- **Compression**: zstd support for rosbags

### Infrastructure
- **Deployment**: Docker Compose
- **Authentication**: JWT, OAuth (GitHub, Google)
- **File Storage**: MinIO, Google Drive
- **Message Queue**: Redis
- **Monitoring**: Prometheus, Grafana, Loki

## Development Setup

```bash
# Clone repository
git clone git@github.com:leggedrobotics/kleinkram.git
cd kleinkram

# Start all services with Docker Compose
docker compose up --build

# Services will be available at:
# - Frontend: http://localhost:8003
# - Backend API: http://localhost:3000
# - MinIO Console: http://localhost:9001
# - Documentation: http://localhost:4000
```

For development of individual components, see their respective AGENTS.md files.

## Project Structure

```
kleinkram/
├── backend/              # NestJS backend API
├── queueConsumer/        # Background job processor
├── frontend/             # Vue 3 web interface
├── cli/                  # Python CLI tool
├── common/               # Shared TypeScript code
├── docs/                 # Documentation (VitePress)
├── examples/             # Example files and scripts
├── observability/        # Monitoring configuration
├── docker-compose.yml    # Main docker compose file
└── AGENTS.md            # This file
```

## Common Development Tasks

### Working with Files
- **Upload processing**: See `queueConsumer/src/files/`
- **File metadata**: See `backend/src/endpoints/file/`
- **Topic extraction**: See `queueConsumer/src/files/helper/converter.ts`

### Working with Actions
- **Action scheduling**: See `backend/src/endpoints/action/`
- **Action execution**: See `queueConsumer/src/actions/`
- **Container management**: See `queueConsumer/src/actions/services/docker-daemon.service.ts`

### Working with Authentication
- **JWT/OAuth**: See `backend/src/endpoints/auth/`
- **Middleware**: See `backend/src/routing/middlewares/`
- **Guards**: See `backend/src/endpoints/auth/roles.decorator.ts`

### Working with Database
- **Entities**: See `common/entities/`
- **Migrations**: TypeORM synchronize is enabled in DEV mode
- **Seeds**: See `common/seeds/`

## Important Patterns

### 1. Queue Pattern
All asynchronous operations use Bull queues:
- File processing
- Action execution
- File cleanup

### 2. Entity Relations
TypeORM entities use decorators for relations. Always load relations explicitly when needed:
```typescript
const file = await this.fileRepository.findOne({
  where: { uuid },
  relations: ['mission', 'mission.project', 'creator']
});
```

### 3. Authentication Flow
1. Middleware resolves user from JWT or API key
2. Guards check permissions using decorators
3. User/Apikey attached to request via `@AddUser()` decorator

### 4. File Storage Strategy
- Original files in MinIO
- Metadata in PostgreSQL
- bag files automatically converted to mcap
- Topics extracted from mcap and stored in DB

## Testing

- **Backend**: Jest tests in `backend/tests/`
- **CLI**: Pytest tests in `cli/tests/`
- **E2E**: Integration tests require backend running locally

## External Documentation

- **Main docs**: https://docs.datasets.leggedrobotics.com/
- **User guide**: See `docs/usage/`
- **Development guide**: See `docs/development/`

## Contribution Guidelines

1. Follow existing code style (ESLint/Prettier configured)
2. Add tests for new features
3. Update relevant AGENTS.md files for architectural changes
4. Use conventional commits for version management
5. Run `yarn tsc:check` and `yarn eslint` before committing

## Version Management

- Monorepo with synchronized versions across packages
- Use `yarn bump` for version increments
- Versions aligned in root, backend, frontend, queueConsumer, cli, common

## Getting Help

For questions about specific components, refer to their individual AGENTS.md files in each directory.
