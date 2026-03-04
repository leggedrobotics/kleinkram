# Python SDK Reference

Installing `kleinkram` using `pip` installs both the CLI and a Python package. The `kleinkram` Python package provides programmatic access to Kleinkram, mirroring most of the CLI's capabilities.

## Authentication

Before using the SDK, make sure to authenticate your environment using the CLI:

```bash
klein login
```

Currently, authentication is only possible by running this CLI command. Once authenticated, the SDK will automatically pick up your credentials.

## Core Usage

You can import all available functions directly from the `kleinkram` package.

```python
import kleinkram
```

### Listing Resources

Retrieve lists of your projects, missions, and files based on specific query parameters.

```python
# List all projects matching a name pattern
projects = kleinkram.list_projects(project_names=["testProject"])

# List missions within specific projects
missions = kleinkram.list_missions(
    project_names=["testProject"],
    mission_names=["testMission"]
)

# List files within specific missions
files = kleinkram.list_files(
    project_names=["testProject"],
    mission_names=["testMission"],
    file_names=["*.bag"]
)
```

### Getting Resources by ID

If you already know the unique identifier for a resource, you can fetch it directly.

```python
project = kleinkram.get_project(project_id="...")
mission = kleinkram.get_mission(mission_id="...")
file = kleinkram.get_file(file_id="...")
```

### Creating Resources

Programmatically set up your workspace by creating new projects and missions.

```python
# Create a new project
kleinkram.create_project(
    project_name="New Project",
    description="My new project description"
)

# Create a mission within a specific project
kleinkram.create_mission(
    mission_name="New Mission",
    project_id="...",
    metadata={"sensor": "lidar"}
)
```

### File Transfer (Upload/Download)

Transfer data locally via Python scripts.

```python
# Upload files to a specific mission
kleinkram.upload(
    project_name="testProject",
    mission_name="testMission",
    files=["data.bag", "metadata.yaml"],
    create=True  # Automatically create the mission if it doesn't exist
)

# Download files from a specific mission
# Note: The destination directory (`dest`) must already exist before downloading.
kleinkram.download(
    project_name="testProject",
    mission_name="testMission",
    dest="./downloaded_data",
    nested=True # Organizes files into dest/project-name/mission-name subdirectories
)
```

### Verifying Files

Check the verification status of your uploaded files.

```python
# Verify if files were successfully uploaded and processed
status = kleinkram.verify(
    project_name="testProject",
    mission_name="testMission",
    files=["data.bag"]
)
```

### Updating Resources

Modify the metadata and descriptions of existing resources.

```python
# Update a project's description
kleinkram.update_project(project_id="...", description="Updated Description")

# Update a mission's metadata tags
kleinkram.update_mission(mission_id="...", metadata={"status": "completed"})

# Trigger a file update (re-process the file)
kleinkram.update_file(file_id="...")
```

### Deleting Resources

Clean up your workspace by programmatically deleting files, missions, or projects.

```python
# Delete a single file
kleinkram.delete_file(file_id="...")

# Delete multiple files simultaneously
kleinkram.delete_files(file_ids=["id_1", "id_2"])

# Delete an entire mission
kleinkram.delete_mission(mission_id="...")

# Delete an entire project
kleinkram.delete_project(project_id="...")
```
