# CLI - AI Agent Documentation

> **Purpose**: This document provides a detailed overview of the Kleinkram CLI architecture for AI agents.

## Overview

The Kleinkram CLI is a **Python command-line interface** for interacting with the Kleinkram dataset storage system. It provides fast, scriptable access to upload, download, and manage files without using the web interface.

**Key Responsibilities**:
- File upload/download with progress tracking
- Project/Mission/File management (CRUD operations)
- Batch operations for CI/CD pipelines
- File verification (hash checking)
- Transparent compression support (zstd)

**Technology Stack**: Python 3.8+, Typer, Rich, Boto3 (S3), httpx, zstandard

## Project Structure

```
cli/
├── kleinkram/
│   ├── api/                    # API client and routes
│   │   ├── client.py          # Authenticated HTTP client
│   │   ├── routes.py          # API endpoint wrappers
│   │   ├── query.py           # Query builders
│   │   ├── file_transfer.py   # Upload/download logic
│   │   ├── pagination.py      # Pagination utilities
│   │   └── deser.py           # Response deserialization
│   ├── cli/                    # CLI commands
│   │   ├── app.py             # Main CLI application
│   │   ├── _download.py       # Download commands
│   │   ├── _upload.py         # Upload commands
│   │   ├── _list.py           # List commands
│   │   ├── _verify.py         # Verify commands
│   │   ├── _file.py           # File commands
│   │   ├── _mission.py        # Mission commands
│   │   ├── _project.py        # Project commands
│   │   ├── _endpoint.py       # Endpoint commands
│   │   └── error_handling.py  # Error handling
│   ├── auth.py                 # OAuth authentication
│   ├── compression.py          # Compression/decompression
│   ├── config.py               # Configuration management
│   ├── core.py                 # Core operations
│   ├── errors.py               # Custom exceptions
│   ├── models.py               # Data models
│   ├── printing.py             # Output formatting
│   ├── utils.py                # Utility functions
│   ├── main.py                 # Entry point
│   └── _version.py             # Version info
├── tests/                      # Pytest tests
├── pyproject.toml             # Project configuration
└── README.md

Key File: cli/kleinkram/cli/app.py:1-238
Key File: cli/kleinkram/core.py:1-315
Key File: cli/kleinkram/compression.py:1-234
```

## Architecture

### CLI Command Structure

Built with **Typer** for type-safe, composable CLI:

```
klein [OPTIONS] COMMAND [ARGS]
  ├── Authentication Commands:
  │   ├── login              # OAuth login
  │   ├── logout             # Logout
  │   ├── endpoint           # Manage endpoints
  │   └── claim              # Claim admin (hidden)
  ├── Core Commands:
  │   ├── upload             # Upload files
  │   ├── download           # Download files
  │   ├── verify             # Verify uploaded files
  │   └── list               # List resources
  └── CRUD Commands:
      ├── project            # Project operations
      ├── mission            # Mission operations
      └── file               # File operations
```

**Global Options**:
- `--verbose`: Enable verbose output (default: True)
- `--debug`: Enable debug mode
- `--log-level`: Set log level
- `--max-lines`: Max table rows (default: 10,000)
- `--version`: Show version

Key File: cli/kleinkram/cli/app.py:96-113

### Configuration System

**Location**: `~/.config/kleinkram/config.json` (Linux/macOS) or `%APPDATA%\kleinkram\config.json` (Windows)

```json
{
  "selected_endpoint": "https://api.datasets.leggedrobotics.com",
  "endpoint_credentials": {
    "https://api.datasets.leggedrobotics.com": {
      "jwt_token": "...",
      "refresh_token": "...",
      "expires_at": 1234567890
    }
  }
}
```

**Functions**:
- `get_config()`: Load configuration
- `save_config()`: Save configuration
- `check_config_compatibility()`: Version check

Key File: cli/kleinkram/config.py

### API Client

**Class**: `AuthenticatedClient`

Wraps `httpx.Client` with:
- Automatic JWT token handling
- Token refresh on expiry
- Endpoint configuration
- Timeout handling

**Usage**:
```python
client = AuthenticatedClient()
response = client.get('/projects')
response.raise_for_status()
data = response.json()
```

Key File: cli/kleinkram/api/client.py

## Core Operations

### 1. Authentication

**Command**: `klein login`

**Flow**:
```
1. klein login --oauth-provider google
   ↓
2. Open browser with OAuth URL
   ↓
3. User authorizes via Google/GitHub
   ↓
4. Redirect to /auth/callback
   ↓
5. CLI polls backend for JWT token
   ↓
6. Save token to config
```

**Supported Providers**:
- `google` (default)
- `github`
- `fake-oauth` (dev only)

**Headless Mode**:
```bash
klein login --headless --key <CLI_KEY>
```

Key File: cli/kleinkram/auth.py

### 2. File Upload

**Command**: `klein upload`

**Usage**:
```bash
# Upload to existing mission
klein upload /path/to/files/*.bag --mission "2024-01-15" --project "ANYmal"

# Create mission if it doesn't exist
klein upload *.mcap --mission "new-mission" --project "MyProject" --create

# With compression support
klein upload data.mcap.zst --mission "test" --project "MyProject"
```

**Upload Flow**:
```
1. Detect if files are compressed (.zst/.zstd)
   ↓
2. Decompress to temp directory (if compressed)
   ↓
3. Verify mission exists (or create if --create)
   ↓
4. Request temporary S3 credentials
   POST /files/temporaryAccess
   ↓
5. Upload to MinIO via boto3 (multipart for large files)
   - Parallel uploads (2 workers)
   - Progress bar per file
   - MD5 hash calculation
   - Retry on failure (3 attempts)
   ↓
6. Confirm upload
   POST /queue/confirmUpload
   ↓
7. Clean up temp files
```

**Key Features**:
- **Compression Support**: Automatic decompression of zstd files
- **Multipart Upload**: Boto3 handles large files efficiently
- **Parallel Uploads**: 2 concurrent uploads by default
- **Progress Tracking**: Rich progress bars with tqdm
- **Hash Verification**: MD5 calculated during upload
- **Retry Logic**: Up to 3 retries on failure
- **Error Handling**: Graceful handling of existing files

Key File: cli/kleinkram/core.py:83-145
Key File: cli/kleinkram/api/file_transfer.py:191-248

#### Compression Support

**Module**: `kleinkram.compression`

**Supported**: zstd only (`.zst`, `.zstd` extensions)

**Why zstd?**
- 5-10x faster decompression than gzip/bzip2
- Excellent compression ratios
- Industry standard for ROS bags
- Tunable compression levels

**Decompression Flow**:
```python
# Detect compression
detect_compression(Path("data.mcap.zst"))  # → CompressionType.ZSTD

# Decompress single file
decompress_file(Path("data.mcap.zst"), output_dir=temp_dir)
  → Creates temp file: /tmp/kleinkram.../data.mcap

# Decompress multiple files
mapping, temp_dir = decompress_files([Path("a.zst"), Path("b.mcap")])
  → {Path("a.zst"): Path("/tmp/.../a.mcap"),
     Path("b.mcap"): Path("b.mcap")}  # Uncompressed files mapped to themselves

# Upload decompressed files
upload_files(client, mapping.values(), mission_id)

# Cleanup
cleanup_temp_dir(temp_dir)
```

**Implementation**:
- Uses `zstandard` library for decompression
- Creates per-file temp directories
- Automatic cleanup on error or completion
- Preserves original filename without compression extension

Key File: cli/kleinkram/compression.py:1-234

### 3. File Download

**Command**: `klein download`

**Usage**:
```bash
# Download all files in a mission
klein download --mission "2024-01-15" --project "ANYmal" --dest /path/to/dest

# Download specific files
klein download --filename "run_001.mcap" --mission "test" --project "MyProject"

# Download with nested directory structure
klein download --mission "..." --project "..." --dest . --nested
```

**Download Flow**:
```
1. Query files matching criteria
   GET /files
   ↓
2. Generate destination paths
   ↓
3. Request download URLs
   GET /files/download?uuid={uuid}&expires=true
   ↓
4. Download via HTTP with resume support
   - Range requests for partial downloads
   - Progress bars
   - Retry on failure (5 attempts with backoff)
   ↓
5. Verify hash (MD5)
```

**Key Features**:
- **Resume Support**: Range requests for partial downloads
- **Parallel Downloads**: 2 concurrent downloads by default
- **Progress Tracking**: Per-file progress bars
- **Hash Verification**: MD5 check after download
- **Retry Logic**: Exponential backoff (2^attempt seconds)
- **Overwrite Protection**: Skip existing files unless --overwrite

Key File: cli/kleinkram/core.py:47-80
Key File: cli/kleinkram/api/file_transfer.py:342-415

### 4. File Verification

**Command**: `klein verify`

**Usage**:
```bash
# Verify files were uploaded correctly
klein verify /path/to/local/*.bag --mission "test" --project "MyProject"

# Check file size only (fast)
klein verify *.mcap --mission "..." --check-file-size

# Skip hash checking
klein verify *.bag --mission "..." --check-file-hash=False
```

**Verification States**:
- `UPLOADED`: File uploaded, hash matches
- `MISSING`: File not on server
- `UPLOADING`: File currently uploading
- `MISMATCHED_HASH`: Hash mismatch
- `MISMATCHED_SIZE`: Size mismatch
- `COMPUTING_HASH`: Server still computing hash
- `UNKNOWN`: Unknown state

Key File: cli/kleinkram/core.py:147-221

### 5. List Operations

**Command**: `klein list`

**Subcommands**:
```bash
# List projects
klein list projects

# List missions in a project
klein list missions --project "ANYmal"

# List files in a mission
klein list files --mission "..." --project "..."

# With filtering
klein list files --mission "..." --project "..." --max-lines 100
```

**Output**: Rich formatted tables with columns:
- Projects: name, uuid, description, created
- Missions: name, uuid, project, date, files_count
- Files: filename, uuid, size, state, date, topics_count

Key File: cli/kleinkram/cli/_list.py

### 6. CRUD Operations

#### Project Commands

```bash
# Create project
klein project create --name "MyProject" --description "..."

# Update project
klein project update <uuid> --name "NewName" --description "..."

# Delete project
klein project delete <uuid>
```

Key File: cli/kleinkram/cli/_project.py

#### Mission Commands

```bash
# Create mission
klein mission create --name "mission-name" --project "ProjectName" --date "2024-01-15"

# Update mission
klein mission update <uuid> --metadata key=value

# Delete mission
klein mission delete <uuid>
```

Key File: cli/kleinkram/cli/_mission.py

#### File Commands

```bash
# Delete file
klein file delete <uuid>

# Get file info
klein file info <uuid>
```

Key File: cli/kleinkram/cli/_file.py

### 7. Endpoint Management

**Commands**:
```bash
# Add endpoint
klein endpoint add https://api.example.com

# Switch endpoint
klein endpoint select https://api.example.com

# List endpoints
klein endpoint list

# Remove endpoint
klein endpoint remove https://api.example.com
```

Key File: cli/kleinkram/cli/_endpoint.py

## Query System

**Module**: `kleinkram.api.query`

**Query Classes**:
- `ProjectQuery`: Filter projects by name, UUID, IDs
- `MissionQuery`: Filter missions by name, UUID, project, date range
- `FileQuery`: Filter files by name, mission, state, tags, topics, date range

**Example**:
```python
from kleinkram.api.query import FileQuery, MissionQuery, ProjectQuery

# Build query
query = FileQuery(
    mission_query=MissionQuery(
        project_query=ProjectQuery(name="ANYmal"),
        name="2024-01-15"
    ),
    filename="run_001.mcap"
)

# Execute query
files = get_files(client, file_query=query)
```

Key File: cli/kleinkram/api/query.py

## Error Handling

**Module**: `kleinkram.errors`

**Custom Exceptions**:
- `KleinkramError`: Base exception
- `MissionNotFound`: Mission doesn't exist
- `ProjectNotFound`: Project doesn't exist
- `FileNotFound`: File doesn't exist
- `AccessDenied`: Insufficient permissions
- `InvalidCLIVersion`: Version mismatch with API

**Error Handler**:
```python
@app.error_handler(Exception)
def base_handler(exc: Exception) -> int:
    display_error(exc, verbose=shared_state.verbose)
    logger.error(format_traceback(exc))
    if shared_state.debug:
        raise exc
    return 1
```

**Display**:
- Verbose mode: Full traceback
- Normal mode: Error message only
- Debug mode: Re-raises exception

Key File: cli/kleinkram/cli/error_handling.py

## Logging

**Location**: `~/.local/state/kleinkram/` (Linux) or `%LOCALAPPDATA%\kleinkram\` (Windows)

**Format**: `{timestamp}.log`

**Levels**:
- DEBUG: Detailed information
- INFO: General information
- WARNING: Warnings (default)
- ERROR: Errors
- CRITICAL: Critical errors

**Usage**:
```bash
klein --log-level DEBUG upload ...
```

Key File: cli/kleinkram/cli/app.py:44-50

## Models

**Module**: `kleinkram.models`

**Data Classes**:
- `File`: File metadata
- `Project`: Project metadata
- `Mission`: Mission metadata
- `Topic`: ROS topic metadata
- `Action`: Action metadata
- `User`: User metadata

**Enums**:
- `FileState`: UPLOADING, OK, ERROR, LOST, FOUND, CONVERSION_ERROR
- `FileType`: BAG, MCAP
- `FileOrigin`: API, GOOGLE_DRIVE, UNKNOWN
- `FileVerificationStatus`: UPLOADED, MISSING, MISMATCHED_HASH, ...

Key File: cli/kleinkram/models.py

## Output Formatting

**Module**: `kleinkram.printing`

**Functions**:
- `files_to_table()`: Format files as Rich table
- `missions_to_table()`: Format missions as Rich table
- `projects_to_table()`: Format projects as Rich table
- `verification_to_table()`: Format verification results

**Features**:
- Rich tables with borders
- Color-coded status (green/yellow/red)
- Truncation for long fields
- Sortable columns

Key File: cli/kleinkram.printing.py

## Utilities

**Module**: `kleinkram.utils`

**Key Functions**:
- `b64_md5(path)`: Calculate base64-encoded MD5 hash
- `format_bytes(bytes, speed=False)`: Human-readable byte sizes
- `format_traceback(exc)`: Format exception traceback
- `check_file_paths(paths)`: Validate file paths
- `get_filename_map(paths)`: Map filenames to paths

Key File: cli/kleinkram/utils.py

## Common Development Tasks

### Adding a New Command

1. Create command file in `cli/kleinkram/cli/_<name>.py`
2. Define Typer app:
   ```python
   import typer
   typer_app = typer.Typer()
   ```
3. Add command functions:
   ```python
   @typer_app.command()
   def my_command(arg: str):
       ...
   ```
4. Register in `cli/kleinkram/cli/app.py`:
   ```python
   from kleinkram.cli._<name> import typer_app as <name>_typer
   app.add_typer(<name>_typer, name="<name>", rich_help_panel=CommandTypes.CORE)
   ```

### Adding a New API Endpoint Wrapper

1. Add function to `cli/kleinkram/api/routes.py`:
   ```python
   def get_my_resource(client: AuthenticatedClient, id: UUID) -> MyResource:
       resp = client.get(f'/my-resource/{id}')
       resp.raise_for_status()
       return MyResource(**resp.json())
   ```

### Adding Compression Support for Another Format

1. Add compression type to `CompressionType` enum
2. Add extension mapping to `COMPRESSION_EXTENSIONS`
3. Implement decompression function (e.g., `decompress_gzip()`)
4. Add case to `decompress_file()`

### Testing

**Framework**: pytest

**Run Tests**:
```bash
cd cli
pytest
```

**Test Categories**:
- Unit tests: Individual functions
- Integration tests: API interaction (requires backend)
- E2E tests: Full workflow tests

## Performance Considerations

- **Parallel Uploads/Downloads**: 2 workers by default (configurable)
- **Multipart Uploads**: Boto3 handles large files efficiently
- **Streaming**: Downloads stream to disk (low memory usage)
- **Compression**: zstd decompression is very fast
- **Connection Pooling**: httpx client reuses connections
- **Retry Logic**: Exponential backoff prevents server overload

## Environment Variables

- `KLEIN_CONFIG_DIR`: Override config directory
- `KLEIN_ENDPOINT`: Override default endpoint
- `KLEIN_LOG_LEVEL`: Override log level

## Version Compatibility

**Version Check**:
```python
cli_version = (0, 51, 1)  # Major, Minor, Patch
api_version = get_api_version()  # From backend

# Major version must match
assert cli_version[0] == api_version[0]

# Minor version mismatch: warning
if cli_version[1] != api_version[1]:
    print(f"Warning: CLI v{cli_version} may not be compatible with API v{api_version}")
```

Key File: cli/kleinkram/cli/app.py:173-187

## Security

- **JWT Tokens**: Stored in config file (permissions: 600)
- **OAuth**: Secure authorization flow via browser
- **S3 Credentials**: Temporary, short-lived credentials
- **API Keys**: Alternative to OAuth for headless environments

## Installation

**From PyPI** (when released):
```bash
pip install kleinkram
```

**From source**:
```bash
cd cli
pip install -e .
```

**Entry Point**: `klein` command

## Related Documentation

- [Root AGENTS.md](../AGENTS.md) - System overview
- [Backend AGENTS.md](../backend/AGENTS.md) - API endpoints
- [Common AGENTS.md](../common/AGENTS.md) - Shared DTOs

## Important Notes

- **Compression**: Only zstd is supported (`.zst`, `.zstd`)
- **File Types**: Only `.bag` and `.mcap` files allowed
- **Filename Rules**: Alphanumeric, underscores, hyphens, dots, spaces, brackets, umlauts only; max 50 chars
- **Upload Limit**: No hard limit, but large files may timeout
- **Concurrent Operations**: Uploads and downloads run in parallel (2 workers default)

## Troubleshooting

1. **Authentication fails**: Check `~/.config/kleinkram/config.json` for valid tokens
2. **Upload hangs**: Check network connection and MinIO accessibility
3. **Hash mismatch**: Re-upload file or check for corruption
4. **Version incompatible**: Update CLI: `pip install --upgrade kleinkram`
5. **Compression error**: Ensure zstandard library installed: `pip install zstandard`
