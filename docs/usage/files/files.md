# Files

Kleinkram supports a variety of robotics data formats. All other files should be stored in a different Cloud Storage Solution like Google Drive.

| Extension | Description |
| :--- | :--- |
| `.mcap` | Standard container format for multimodal data (ROS2, Foxglove). |
| `.bag` | Legacy ROS1 bag file. Automatically converted to MCAP on upload. |
| `.db3` | ROS2 bag file (SQLite3). |
| `.svo2` | ZED camera recording (v2) |
| `.tum` | TUM dataset format |
| `.yaml` / `.yml` | YAML configuration files |

::: tip Requesting New File Types
If you need support for additional file types, please [open a new issue](https://github.com/leggedrobotics/kleinkram/issues/new) on GitHub.
:::

::: details Auto-converting `.bag` to `.mcap`
Auto-converting `.bag` to `.mcap` is disabled by default for all new projects. Kleinkram supports topic extraction and preview for both `.bag` and `.mcap` files.

Native translation of `.bag` files to `.mcap` (using `ros1msg` encoding) is supported but opt-in. We do not support native translation to `ros2msg`. Users are encouraged to use Actions for custom conversion needs.
:::

## File States

In the Kleinkram UI the filestates are displayed as Icons with a short explanation on hover. Here a more indepth explanation.

| Icon                                                                                          | Name             | Description                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <span class="material-symbols-outlined" style="color: green">check_circle</span>              | OK               | Everything is OK                                                                                                                               |
| <span class="material-symbols-outlined" style="color: orange">arrow_upload_progress</span>    | Uploading        | The File is being uploaded to the File Storage. Should switch to OK when completed. Will switch to ERROR after 12h in _Uploading_.             |
| <span class="material-symbols-outlined" style="color: red">conversion_path_off</span>         | Conversion Error | The File was uploaded, the MD5 was correct but it is not a valid bag / mcap. Check locally if it is valid. If it is, contact an Admin!         |
| <span class="material-symbols-outlined" style="color: red">error</span>                       | Error            | Something went wrong. Contact an Admin to find out more.                                                                                       |
| <span class="material-symbols-outlined" style="color: red">sentiment_very_dissatisfied</span> | Corrupted        | The File was uploaded but its MD5 hash doesn't match. Delete it and upload it again. Contact an Admin.                                         |

::: details Advanced File States (Raw)
These states are typically only relevant for administrators or debugging purposes.

| Icon                                                                                          | Name             | Description                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| <span class="material-symbols-outlined" style="color: green">helicopter</span>                | Found            | The File was found in the File storage but not in the database. It was then restored. This should not happen! Contact an Admin.                |
| <span class="material-symbols-outlined" style="color: orange">move_up</span>                  | Moving           | The File is being moved within the File Storage. This can happen when a Mission is moved to another project or a project / mission is renamed. |
| <span class="material-symbols-outlined" style="color: red">pulse_alert</span>                 | Lost             | The File is registered within the database but cannot be found in the File Storage. This is bad. Contact an Admin!                             |
:::
