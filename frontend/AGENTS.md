# Frontend - AI Agent Documentation

> **Purpose**: This document provides a detailed overview of the Kleinkram frontend architecture for AI agents.

## Overview

The frontend is a **Vue 3 web application** built with Quasar framework that provides a user interface for managing robotics datasets. It communicates with the backend REST API for all data operations.

**Key Responsibilities**:
- Project/Mission/File browsing and management
- File upload (direct to MinIO via S3 SDK)
- Action submission and monitoring
- Access control management
- Data visualization and querying

**Technology Stack**: Vue 3, Quasar, TypeScript, Tanstack Query (Vue Query), Axios, AWS S3 SDK, ECharts

## Project Structure

```
frontend/
├── src/
│   ├── api/                   # API client and axios setup
│   ├── boot/                  # Quasar boot files
│   ├── components/            # Vue components
│   │   ├── button-wrapper/   # Dialog opener components
│   │   └── *.vue             # Reusable components
│   ├── css/                   # Global styles
│   ├── dialogs/               # Modal dialogs
│   ├── enums/                 # TypeScript enums
│   ├── hooks/                 # Vue composables
│   │   ├── crumbs.ts         # Breadcrumb hooks
│   │   ├── query-hooks.ts    # Tanstack Query hooks
│   │   ├── mutation-hooks.ts # Mutation hooks
│   │   ├── router-hooks.ts   # Router utilities
│   │   └── utility-hooks.ts  # General utilities
│   ├── layouts/               # Page layouts
│   │   ├── main-layout/      # Main app layout (with nav)
│   │   └── no-top-nav-layout.vue  # Auth layout
│   ├── pages/                 # Page components
│   ├── router/                # Vue Router configuration
│   │   ├── routes.ts         # Route definitions
│   │   └── index.ts          # Router setup
│   ├── services/              # Business logic and API calls
│   │   ├── queries/          # GET request services
│   │   ├── mutations/        # POST/PUT/DELETE services
│   │   ├── auth.ts           # Authentication
│   │   ├── file-service.ts   # File upload logic
│   │   └── *.ts              # Other services
│   ├── app.vue                # Root component
│   ├── environment.ts         # Environment configuration
│   └── quasar.d.ts            # Quasar TypeScript declarations
├── public/                    # Static assets
├── quasar.config.js          # Quasar configuration
├── tsconfig.json             # TypeScript configuration
└── package.json

Key File: frontend/src/router/routes.ts:1-200
Key File: frontend/src/services/file-service.ts:1-472
```

## Architecture

### Component Architecture

```
App.vue
  └── Router View
      └── Layout (main-layout or no-top-nav-layout)
          └── Page Component
              └── Components & Dialogs
```

**Key Layouts**:
1. **main-layout**: Standard app layout with top navigation, breadcrumbs, and sidebar
2. **no-top-nav-layout**: Minimal layout for login and error pages

### State Management

Kleinkram uses **Tanstack Query (Vue Query)** instead of traditional Vuex/Pinia for state management:

**Benefits**:
- Automatic caching and invalidation
- Background refetching
- Optimistic updates
- Loading and error states
- Request deduplication

**Query Keys Pattern**:
```typescript
// Queries are organized by entity type
['files', missionUuid]        // Files in a mission
['missions', projectUuid]     // Missions in a project
['projects']                  // All projects
['action', actionUuid]        // Single action
['isUploading']               // Upload status
```

Key File: frontend/src/hooks/query-hooks.ts

### API Client

**Axios Instance** with interceptors:
- Automatic cookie handling (JWT tokens)
- Error handling
- Response transformation

Key File: frontend/src/api/axios.ts

### Routing

Vue Router with lazy-loaded components:

**Route Structure**:
```
/                                    - Home/Landing
/login                               - Login page
/projects                            - Projects list
/project/:projectUuid/missions       - Missions in project
/project/:projectUuid/mission/:missionUuid/files  - Files in mission
/project/.../file/:fileUuid          - File details
/actions                             - Actions list
/action/:actionUuid                  - Action details
/upload                              - Upload page
/access-groups                       - Access groups
/user-profile                        - User profile
```

**Protected Routes**: All routes except `/login`, `/`, `/error-403`, `/error-404` require authentication.

Key File: frontend/src/router/routes.ts:1-200

## Key Features

### 1. Authentication

**Service**: `frontend/src/services/auth.ts`

```typescript
// Login via OAuth
login(provider: 'google' | 'github')
  → Redirects to /auth/{provider}
  → Backend handles OAuth flow
  → Returns with JWT cookie

// Get current user
getUser()
  → Cached user object
  → Fetches from /auth/me

// Check authentication
isAuthenticated()

// Logout
logout()
  → POST /auth/logout
  → Reloads page to clear cache
```

**User Cache**: Single in-memory cache to avoid redundant API calls.

Key File: frontend/src/services/auth.ts:1-57

### 2. File Upload

**Service**: `frontend/src/services/file-service.ts`

#### Upload Flow

```
1. User selects files (drag & drop or file input)
   ↓
2. Validate filenames (.bag/.mcap, valid chars, <50 chars)
   ↓
3. Request temporary S3 credentials
   POST /files/temporaryAccess
   → Returns access key, secret, session token, bucket, fileUUID
   ↓
4. Upload directly to MinIO via S3 SDK
   - Multipart upload (50MB parts)
   - MD5 hash calculation (SparkMD5)
   - Progress tracking
   - Retry logic (up to 60 retries per part)
   ↓
5. Confirm upload with backend
   POST /queue/confirmUpload
   → Backend enqueues file processing job
   ↓
6. Poll for file status
   GET /file/exists
   → Every 20 parts during upload
```

**Key Features**:
- **Multipart Upload**: 50MB chunks for large files
- **Parallel Uploads**: Up to 5 concurrent files (p-limit)
- **MD5 Verification**: Client-side hash calculation
- **Upload Cancellation**: Abort multipart upload, notify backend
- **Before Unload Warning**: Prevents accidental tab closure

**Google Drive Import**:
```typescript
driveUpload(missionUuid, driveUrl)
  → POST /queue/createDrive
  → Backend downloads from Drive
  → Files processed asynchronously
```

Key File: frontend/src/services/file-service.ts:30-471

### 3. File Download

Files are downloaded via pre-signed MinIO URLs:

```
1. GET /files/download?uuid={fileUuid}&expires=true
   ↓
2. Backend generates pre-signed URL (4 hours validity)
   ↓
3. Frontend opens URL in new tab
   ↓
4. Browser downloads directly from MinIO
```

### 4. Queries (GET Requests)

**Location**: `frontend/src/services/queries/`

Organized by entity:
- **file.ts**: File queries (list, single, topics)
- **mission.ts**: Mission queries
- **project.ts**: Project queries
- **action.ts**: Action queries
- **user.ts**: User queries
- **worker.ts**: Worker queries
- **queue.ts**: Queue status
- **tag.ts**: Tag queries
- **access.ts**: Access control queries

**Example Query**:
```typescript
// frontend/src/services/queries/file.ts
export const getFiles = (missionUuid: string) =>
  useQuery({
    queryKey: ['files', missionUuid],
    queryFn: () => axios.get(`/files/ofMission?uuid=${missionUuid}`),
    staleTime: 30000, // 30 seconds
  });
```

### 5. Mutations (POST/PUT/DELETE)

**Location**: `frontend/src/services/mutations/`

Organized by entity:
- **file.ts**: File operations (upload, delete, move)
- **mission.ts**: Mission CRUD
- **project.ts**: Project CRUD
- **action.ts**: Action submission
- **queue.ts**: Queue operations
- **access.ts**: Access control

**Example Mutation**:
```typescript
// frontend/src/services/mutations/file.ts
export const deleteFile = (fileUuid: string) =>
  axios.delete(`/file/${fileUuid}`);
```

**Optimistic Updates**: Some mutations use optimistic updates to improve UX.

### 6. Data Visualization

**Library**: ECharts (vue-echarts)

Used for:
- Storage usage charts
- Action timeline
- File size distribution
- Topic frequency visualization

### 7. Access Control UI

**Pages**:
- `/access-groups`: List all access groups
- `/access-group/:uuid`: Access group details

**Features**:
- Create/edit access groups
- Add/remove users from groups
- Set expiration dates
- Assign group permissions to projects/missions

## Pages

### Main Pages

1. **Dashboard** (`pages/dashboard-page.vue`)
   - Storage overview
   - Recent activity
   - Quick actions

2. **Projects Explorer** (`pages/projects-explorer-page.vue`)
   - List all accessible projects
   - Create new projects
   - Search and filter

3. **Missions Explorer** (`pages/missions-explorer-page.vue`)
   - List missions in a project
   - Create new missions
   - Mission metadata

4. **Files Explorer** (`pages/files-explorer-page.vue`)
   - List files in a mission
   - Advanced filtering (topics, tags, date range)
   - File operations (download, delete, move)
   - Pagination

5. **File Details** (`pages/file-info-page.vue`)
   - File metadata
   - Topic list
   - Tags
   - Related files (bag ↔ mcap)

6. **Actions** (`pages/action-page.vue`)
   - List all actions
   - Filter by mission, status
   - Submit new actions

7. **Action Details** (`pages/action-details-page.vue`)
   - Action status
   - Live logs
   - Exit code
   - Artifacts link

8. **Upload** (`pages/upload-page.vue`)
   - File upload interface
   - Google Drive import
   - Upload queue status

9. **User Profile** (`pages/user-profile-page.vue`)
   - User information
   - API keys management
   - Preferences

### Key Components

1. **running-actions.vue**
   - Shows running actions in sidebar
   - Real-time status updates
   - Quick access to action logs

2. **button-wrapper/*  **
   - Dialog opener components
   - Consistent dialog patterns
   - Examples: create-project, delete-file, move-file

## Hooks (Composables)

### Query Hooks

**File**: `frontend/src/hooks/query-hooks.ts`

Reusable query logic:
```typescript
// Example: Use file query with auto-refresh
const { data: files, isLoading, error } = useFilesQuery(missionUuid);
```

### Mutation Hooks

**File**: `frontend/src/hooks/mutation-hooks.ts`

Reusable mutation logic with automatic cache invalidation:
```typescript
// Example: Delete file mutation
const { mutate: deleteFile } = useDeleteFileMutation();

deleteFile(fileUuid, {
  onSuccess: () => {
    queryClient.invalidateQueries(['files']);
  },
});
```

### Router Hooks

**File**: `frontend/src/hooks/router-hooks.ts`

Router utilities:
- Route parameter extraction
- Navigation helpers
- Breadcrumb generation

### Utility Hooks

**File**: `frontend/src/hooks/utility-hooks.ts`

General utilities:
- Date formatting
- File size formatting
- Permission checks

## Environment Configuration

**File**: `frontend/src/environment.ts`

```typescript
ENV.ENDPOINT           // Backend API URL
ENV.BASE_URL           // Frontend base URL
ENV.PROJECT_NAME       // Project name
ENV.DOCS_URL           // Documentation URL
```

Loaded from environment variables (set by Quasar build).

## Common Development Tasks

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `src/router/routes.ts`
3. Add breadcrumbs if needed
4. Use query hooks for data fetching
5. Add to navigation if needed

### Adding a New API Call

1. **Query** (GET):
   - Add function in `src/services/queries/{entity}.ts`
   - Use Tanstack Query's `useQuery`
   - Add query key for caching

2. **Mutation** (POST/PUT/DELETE):
   - Add function in `src/services/mutations/{entity}.ts`
   - Use Axios directly or `useMutation`
   - Invalidate relevant queries on success

### Adding a New Dialog

1. Create dialog component in `src/dialogs/`
2. Create button-wrapper component in `src/components/button-wrapper/`
3. Use Quasar dialog (`useDialogPluginComponent`)
4. Emit events for actions

### Debugging

1. **Vue Devtools**: Inspect component state, props, emits
2. **Network Tab**: Check API requests and responses
3. **Tanstack Query Devtools**: Inspect query cache
4. **Console**: Use `console.log()` strategically

## Important Patterns

### 1. Query Invalidation

Always invalidate queries after mutations:
```typescript
await deleteFile(fileUuid);
await queryClient.invalidateQueries(['files', missionUuid]);
```

### 2. Loading States

Use Tanstack Query's built-in loading states:
```typescript
const { data, isLoading, error } = useQuery(...);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
```

### 3. Optimistic Updates

For better UX, update cache optimistically:
```typescript
const { mutate } = useMutation({
  mutationFn: updateFile,
  onMutate: async (newData) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries(['file', fileUuid]);

    // Snapshot current value
    const previous = queryClient.getQueryData(['file', fileUuid]);

    // Optimistically update
    queryClient.setQueryData(['file', fileUuid], newData);

    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(['file', fileUuid], context.previous);
  },
});
```

### 4. File Upload Progress

Track upload progress using refs:
```typescript
const uploadingFiles = ref<Record<string, number>>({});

// Update progress during upload
newFileUpload.value.uploaded = (current ?? 0) + chunkSize;
```

### 5. Before Unload

Prevent accidental tab closure during uploads:
```typescript
window.addEventListener('beforeunload', confirmDialog);
// ... upload logic
window.removeEventListener('beforeunload', confirmDialog);
```

## Styling

**Framework**: Quasar (Material Design)

**Global Styles**: `src/css/`

**Component Styles**: Scoped `<style>` blocks in `.vue` files

**Utility Classes**: Quasar's built-in utility classes

## Build & Development

**Development**:
```bash
cd frontend
yarn dev
```

**Production Build**:
```bash
yarn build
```

**Output**: `dist/spa/` directory

## Testing

Tests are minimal. Most testing is manual via:
1. Local development server
2. Staging environment
3. E2E testing (manual)

## Related Documentation

- [Root AGENTS.md](../AGENTS.md) - System overview
- [Backend AGENTS.md](../backend/AGENTS.md) - API endpoints
- [Common AGENTS.md](../common/AGENTS.md) - Shared DTOs

## Performance Considerations

- **Lazy Loading**: All routes lazy-loaded
- **Query Caching**: Tanstack Query caches responses
- **Pagination**: File lists paginated (default 50 items)
- **Direct S3 Upload**: Bypasses backend for file transfer
- **Multipart Upload**: Handles large files efficiently
- **Debouncing**: Search inputs debounced

## Security

- **JWT Cookies**: HttpOnly cookies for authentication
- **S3 Temporary Credentials**: Short-lived (expires quickly)
- **CORS**: Backend configured for frontend origin
- **Input Validation**: Client-side validation before API calls
- **XSS Prevention**: Vue 3's automatic escaping

## Browser Support

Modern browsers only (ES6+):
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

No IE11 support.
