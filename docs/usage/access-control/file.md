# File

The valid operations that can be performed on a file are:

| **Operation** | **Description**       | **Access Level**                                                                                                                                   |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| view          | View an existing File | <Read />                                                                                                                                           |
| download      | Download a File       | <Read />                                                                                                                                           |
| create        | Create a new File     | <Create />                                                                                                                                         |
| rename        | Rename a File         | <Write /> <Creator/>                                                                                                                               |
| move          | Move a File           | <Delete hint="Delete Rights are required on the Mission it is removed from, Create where it is added"/> <Creator hint="Create where it is added"/> |
| delete        | Delete a File         | <Delete /> <Creator/>                                                                                                                              |

The creator of a file can rename, move and delete it even if they only have <Create/> on the project.

### Example

**Scenario**: A large dataset contains raw logs, processed data, and video recordings.

- **Raw Logs**: Only core engineers should be able to delete raw logs (`Delete` right).
- **Processed Data**: Researchers can generate and upload processed data (`Write` right).
- **Public Release**: A specific set of files is approved for public release. Access cannot be granted on single
  files, so copy them into a separate project and [make that project public](./base-concepts.md#public-projects).
