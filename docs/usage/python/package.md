# Kleinkram Python Package

By installing `kleinkram` you also automatically get access to a python package that exposes most of the functionality that the CLI offers.

## Authentication

Make sure to authenticate yourself using the CLI:

```bash
klein login
```

Currently there is no way to authenticate yourself without the cli.

## Examples

### Listing Resources

```python
from kleinkram import delete_file
from kleinkram import delete_file
from kleinkram import delete_file

files = list_files(file_names=...)
missions = list_missions(mission_names=...)
projects = list_projects(project_names=...)
```

### Deleting Resources

```python
from kleinkram import delete_file
from kleinkram import delete_files
from kleinkram import delete_mission
from kleinkram import delete_project

delete_file(file_id=...)
delete_files(file_ids=[...])
delete_mission(mission_id=...)
delete_project(project_id=...)
```

All interfaces are typed so you can take a look at the `/kleinkram/wrappers.py` file to see what other functions are available.
