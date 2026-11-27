# Files

Kleinkram supports a variety of robotics data formats. All other files should be stored in a different Cloud Storage Solution like Google Drive.

| Extension        | Description                                                      |
| :--------------- | :--------------------------------------------------------------- |
| `.mcap`          | Standard container format for multimodal data (ROS2, Foxglove).  |
| `.bag`           | Legacy ROS1 bag file. Optionally converted to MCAP on upload.    |
| `.db3`           | ROS2 bag file (SQLite3).                                         |
| `.svo2`          | ZED camera recording (v2)                                        |
| `.tum`           | TUM dataset format                                               |
| `.yaml` / `.yml` | YAML configuration files                                         |
| `.md`            | Markdown notes, rendered in the file preview                     |
| `.csv`           | Comma/semicolon/tab separated tables, shown as a table preview   |
| `.log`           | Text logs and NovAtel receiver logs, see [Log files](#log-files) |

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

## Log Files

`.log` is used by many tools for unrelated formats, so Kleinkram looks at the content of a `.log` file to pick its
preview:

| Content                                     | Preview                                                                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NovAtel OEM7 receiver log (binary or ASCII) | Receiver, recording time, position solution, a map of the track and a table of the logged messages with their count and rate.                          |
| Text                                        | The lines, with the level (`ERROR`, `WARN`, `INFO`, `DEBUG`) detected per line. Filter by level or search. Large logs show the first or the last 2 MB. |
| Anything else (another vendor's binary log) | None. The file is kept and can be downloaded.                                                                                                          |

A NovAtel log is recognised by its message frames and their CRC-32 checksums; it needs no special name. The preview
reads only parts of the file: the message table covers the first 4 MB, and the track is sampled across the whole file.
Only an empty `.log` file is marked as corrupted.

NovAtel receivers name their logs with an uppercase extension (`.LOG`). File names are stored with a lowercase
extension: the upload dialog renames such a file to `.log` for you, and `klein upload` does so with `--fix-filenames`.

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

If an upload is confirmed but its data never reached the file storage (e.g. the transfer was interrupted), the upload
fails with _File not found in storage. Upload it again._ Upload the file again; the CLI does the same with `klein upload`.

::: details Advanced File States
These states are typically only relevant for administrators or debugging purposes.

| Icon                                                                           | Name       | Description                                                                                                             |
| ------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| —                                                                              | Converting | The `.mcap` that Kleinkram creates from an uploaded `.bag` is being written.                                            |
| —                                                                              | Canceled   | The upload was canceled before it finished. Canceled uploads are removed after 24 hours.                                |
| <span class="material-symbols-outlined" style="color: red">pulse_alert</span>  | Lost       | The file is in the database but cannot be found in the file storage (checked every night). Contact an admin.            |
| <span class="material-symbols-outlined" style="color: green">helicopter</span> | Found      | The file was in the file storage but not in the database, and was restored. Older versions of Kleinkram set this state. |

:::

## Topics on the File Page

The file page of a `.mcap` or `.bag` lists its topics. Next to the message count it shows:

- **mean Hz**: the message count divided by the time between the first and the last chunk that holds the topic. A
  topic that starts late or stops early gets its real rate, not one averaged over the whole recording. One-shot topics
  such as `/tf_static` (seen in fewer than 5 chunks of a file with at least 5) and single messages have no rate and
  show `—`.
- **Coverage**: 20 slices of the recording, filled where the topic has data. Hover the strip for the first and last time
  the topic was seen. A topic that stays silent for much longer than its own rate gets a warning under the strip;
  hatched slices mark a pause of the whole recording.

Both are read from the file's chunk index, so they are exact to one chunk. Kleinkram stores them when it processes a
file and backfills them for older files. Until a `.mcap` has been backfilled, the page reads them from the file itself;
a `.bag` shows them only once they are stored.

## Moving and Copying Files

To move or copy files into another mission, select them in the file table of a mission and click **Move**. The dialog
lets you:

- choose **Move** or **Copy**. A copy keeps the originals; the data is copied on the server, nothing is downloaded.
- pick any mission you may add files to, also of another project, or create a **new mission** in place (with the
  metadata the project requires).
- resolve name conflicts. A mission cannot hold two files with the same name. Files whose name is taken in the target
  mission are marked; give them a new name or skip them.
- copy the equivalent `klein file move` / `klein file copy` command.

Moving needs <Delete /> rights on the files, copying <Read /> rights; both need <Create /> rights on the target
mission. API keys cannot move or copy files.

Both are all-or-nothing: if a name conflict is left, Kleinkram rejects the request, lists the conflicting names and
changes nothing. A copy keeps the topics, dates and hash of its original. Categories belong to a project, so a copy into
another project has none.

To share only a subset of a mission with other people, copy the files into a new mission of a project they can access.
