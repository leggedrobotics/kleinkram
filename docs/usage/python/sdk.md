# Kleinkram Python Package

Installing `kleinkram` using `pip` will also install a python package that exposes most of the functionality that the CLI offers.

## Authentication

Make sure to authenticate using the CLI:

```bash
klein login
```

Currently authentication is only possible through the CLI.

## Usage

You can import the functions directly from the `kleinkram` package.

```python
import kleinkram
```

### Listing Resources

```python
# List projects
projects = kleinkram.list_projects(project_names=["my-project"])

# List missions
missions = kleinkram.list_missions(
    project_names=["my-project"], 
    mission_names=["my-mission"]
)

# List files
files = kleinkram.list_files(
    project_names=["my-project"],
    mission_names=["my-mission"],
    file_names=["*.bag"]
)
```

### Getting Resources by ID

```python
project = kleinkram.get_project(project_id="...")
mission = kleinkram.get_mission(mission_id="...")
file = kleinkram.get_file(file_id="...")
```

### Creating Resources

```python
# Create a project
kleinkram.create_project(
    project_name="New Project", 
    description="My new project"
)

# Create a mission
kleinkram.create_mission(
    mission_name="New Mission",
    project_id="...",
    metadata={"key": "value"}
)
```

### Uploading and Downloading

```python
# Upload files
kleinkram.upload(
    project_name="my-project",
    mission_name="my-mission",
    files=["data.bag", "metadata.yaml"],
    create=True # Create mission if it doesn't exist
)

# Download files
kleinkram.download(
    project_name="my-project",
    mission_name="my-mission",
    dest="./downloaded_data"
)
```

### Verifying Files

```python
# Verify uploaded files
status = kleinkram.verify(
    project_name="my-project",
    mission_name="my-mission",
    files=["data.bag"]
)
```

### Updating Resources

```python
# Update project description
kleinkram.update_project(project_id="...", description="New description")

# Update mission metadata
kleinkram.update_mission(mission_id="...", metadata={"new_key": "new_value"})

# Update file (re-process)
kleinkram.update_file(file_id="...")
```

### Deleting Resources

```python
# Delete a file
kleinkram.delete_file(file_id="...")

# Delete multiple files
kleinkram.delete_files(file_ids=["...", "..."])

# Delete a mission
kleinkram.delete_mission(mission_id="...")

# Delete a project
kleinkram.delete_project(project_id="...")
```
