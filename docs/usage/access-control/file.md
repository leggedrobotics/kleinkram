# File

The valid operations that can be performed on a file are:
| **Operation** | **Description** | **Access Level** |
|---------------|-------------------------------|------------------|
| view | View an existing File | <Read /> |
| download | Download a File | <Read /> |
| create | Create a new File | <Create /> |
| rename | Rename a File | <Modify /> <Creator/> |
| move | Move a File | <Delete hint="Delete Rights are required on the Mission it is removed from, Create where it is added"/> <Creator hint="Create where it is added"/> |
|- **Delete**: Can delete the file.

### Example

**Scenario**: A large dataset contains raw logs, processed data, and video recordings.

- **Raw Logs**: Only core engineers should be able to delete raw logs (`Delete` right).
- **Processed Data**: Researchers can generate and upload processed data (`Write` right).
- **Public Release**: A specific set of files is approved for public release. A "Public" group could be given `Read` access to these specific files.
  | delete | Delete a File | <Delete /> <Creator/> |
