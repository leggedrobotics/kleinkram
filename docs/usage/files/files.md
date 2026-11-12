# Files

Kleinkram supports a variety of robotics data formats. All other files should be stored in a different Cloud Storage Solution like Google Drive.

| Extension        | Description                                                     |
| :--------------- | :-------------------------------------------------------------- |
| `.mcap`          | Standard container format for multimodal data (ROS2, Foxglove). |
| `.bag`           | Legacy ROS1 bag file. Optionally converted to MCAP on upload.   |
| `.db3`           | ROS2 bag file (SQLite3).                                        |
| `.svo2`          | ZED camera recording (v2)                                       |
| `.tum`           | TUM dataset format                                              |
| `.yaml` / `.yml` | YAML configuration files                                        |
| `.md`            | Markdown notes, rendered in the file preview                    |
| `.csv`           | Comma/semicolon/tab separated tables, shown as a table preview  |

::: tip Requesting New File Types
If you need support for additional file types, please [open a new issue](https://github.com/leggedrobotics/kleinkram/issues/new) on GitHub.
:::

::: details Auto-converting `.bag` to `.mcap`
Auto-converting `.bag` to `.mcap` is disabled by default for all new projects. Kleinkram supports topic extraction and preview for both `.bag` and `.mcap` files.

Native translation of `.bag` files to `.mcap` (using `ros1msg` encoding) is supported but opt-in. We do not support native translation to `ros2msg`. Users are encouraged to use Actions for custom conversion needs.
:::

::: tip Compressing MCAP files
Compress `.mcap` files inside the file (chunk compression), not as a whole: a `.mcap.zst` or `.mcap.gz` is not
accepted. See [MCAP Chunking and Compression](./compression.md).
:::

## File States

In the Kleinkram UI the file states are displayed as icons. Hovering over the icon shows the state and, for errors,
what went wrong.

| Icon                                                                                          | Name             | Description                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span class="material-symbols-outlined" style="color: green">check_circle</span>              | OK               | The file is stored and was processed.                                                                                                                                                                      |
| <span class="material-symbols-outlined" style="color: orange">arrow_upload_progress</span>    | Uploading        | The file is being uploaded or processed. It switches to OK when done, and to Error if it is still uploading after 12 hours.                                                                                |
| <span class="material-symbols-outlined" style="color: red">sentiment_very_dissatisfied</span> | Corrupted        | The content does not match the file type, or the file cannot be read (e.g. an `.mcap` without a summary section). Check the file locally, e.g. with `mcap doctor`, then delete it and upload a fixed copy. |
| <span class="material-symbols-outlined" style="color: red">conversion_path_off</span>         | Conversion Error | The file was read, but converting it (`.bag` to `.mcap`) or saving the extracted topics failed. If the file is valid locally, contact an admin.                                                            |
| <span class="material-symbols-outlined" style="color: red">error</span>                       | Error            | Something else went wrong, e.g. the upload timed out. Contact an admin to find out more.                                                                                                                   |

::: info Checking the content of an upload
The server does not compare the content of a file with what you uploaded. Use `klein verify` to check that the files
in a mission have the same size and hash as your local files (see the [CLI reference](../python/cli.md#verifying-resources)).
:::

::: details Advanced File States
These states are typically only relevant for administrators or debugging purposes.

| Icon                                                                           | Name       | Description                                                                                                             |
| ------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| —                                                                              | Converting | The `.mcap` that Kleinkram creates from an uploaded `.bag` is being written.                                            |
| —                                                                              | Canceled   | The upload was canceled before it finished. Canceled uploads are removed after 24 hours.                                |
| <span class="material-symbols-outlined" style="color: red">pulse_alert</span>  | Lost       | The file is in the database but cannot be found in the file storage. Contact an admin.                                  |
| <span class="material-symbols-outlined" style="color: green">helicopter</span> | Found      | The file was in the file storage but not in the database, and was restored. Older versions of Kleinkram set this state. |

:::
