# MCAP Chunking and Compression

How an `.mcap` file is written decides how large it is, whether Kleinkram can read it, and how much a
[partial download](./partial-download.md) has to transfer. Kleinkram stores the file exactly as you upload it, so these
choices are made on the robot or before the upload.

::: tip Summary

- **Compress inside the file, never the whole file.** MCAP compresses each chunk on its own. A whole-file compressed
  `.mcap.zst` or `.mcap.gz` cannot be uploaded at all: only the [supported extensions](./files.md) are accepted.
- **Uncompressed chunks** (the `ros2 bag record` default) are the most flexible: partial downloads can select both
  topics and a time window.
- **Compressed chunks** (`zstd_fast`, `zstd_small`) make files smaller, but a partial download can only save
  bandwidth with a time window, not with `--topics` alone.
- **No chunks** (the `fastwrite` preset) means a partial download transfers the whole file. Convert such files
  before uploading if you want to slice them later.
- **A file without a summary section** (e.g. a recording that was cut off) is marked _Corrupted_. Repair it with
  `mcap recover` before uploading.

:::

## How an MCAP file is laid out

An MCAP file has a **data section** and, at the end, a **summary section**:

- In the data section, messages are grouped into **chunks**. Each chunk can be compressed with `zstd` or `lz4`, and is
  followed by a **message index** that lists the offset and log time of every message in it.
- The summary section lists the topics, the message counts and, for every chunk, its time range, the topics it holds
  and where its message index is.

When it processes an upload, Kleinkram takes the topics, message counts, frequencies and the recording time from the
summary section, so a file without one is marked _Corrupted_. A partial download uses the summary and the message indexes to fetch only the bytes it needs.
A compressed chunk can only be decompressed as a whole, so it can only be fetched as a whole.

## Choosing a layout

| Layout                                                                | Typical source                         | Size     | Partial download by time         | Partial download by topic     |
| --------------------------------------------------------------------- | -------------------------------------- | -------- | -------------------------------- | ----------------------------- |
| Uncompressed chunks                                                   | `ros2 bag record -s mcap` (no preset)  | Largest  | Fetches only the messages        | Fetches only the messages     |
| Compressed chunks                                                     | `zstd_fast` or `zstd_small` preset     | Smaller  | Fetches the chunks in the window | Fetches nearly the whole file |
| No chunks                                                             | `fastwrite` preset                     | Largest  | Fetches the whole file           | Fetches the whole file        |
| No summary section                                                    | Recording cut off (crash, power loss)  | —        | Marked _Corrupted_ on upload     | Marked _Corrupted_ on upload  |
| Whole-file compressed (`.mcap.zst`, rosbag2 `compression_mode: file`) | `zstd`, `gzip`, `ros2 bag` compression | Smallest | Cannot be uploaded               | Cannot be uploaded            |

Which one to use depends on how the data is read later:

- If people download **single topics** (e.g. `/rosout`, or one camera) from long recordings, keep the chunks
  **uncompressed**.
- If storage or upload bandwidth matters more, and recordings are mostly processed with
  [Actions](../actions/use-actions.md) (which run next to the storage) or sliced by **time**, use **compressed chunks**.

## Recording on the robot

The MCAP storage plugin of rosbag2 has these presets, selected with `--storage-preset-profile`:

| Preset         | What it writes                                                      | Use it when                                                                  |
| -------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| none (default) | Uncompressed chunks with message indexes.                           | You want the most flexible partial downloads.                                |
| `fastwrite`    | No chunks, so no message indexes. No summary CRC.                   | Write throughput is the bottleneck. Convert the file before uploading.       |
| `zstd_fast`    | Chunks compressed with zstd at its fastest level, no chunk CRC.     | Disk space on the robot is limited, but CPU must stay low.                   |
| `zstd_small`   | 4 MiB chunks compressed with zstd at its slowest (strongest) level. | Files have to be as small as possible, e.g. to transfer them over a network. |

```bash
# uncompressed chunks
ros2 bag record -s mcap --all

# compressed chunks, low CPU cost
ros2 bag record -s mcap --storage-preset-profile zstd_fast --all
```

For other settings, pass a YAML file with the MCAP writer options. Options in this file override the preset:

```yaml
# mcap_writer_options.yaml
compression: 'Zstd' # "None", "Lz4" or "Zstd"
compressionLevel: 'Default' # "Fastest", "Fast", "Default", "Slow" or "Slowest"
chunkSize: 4194304 # target uncompressed chunk size, in bytes
```

```bash
ros2 bag record -s mcap --storage-config-file mcap_writer_options.yaml --all
```

::: warning Chunk size and crashes
Messages are kept in memory until their chunk is full and written. If the recorder crashes or loses power, the
current chunk is lost, and the file has no summary section. Keep chunks small enough that a new one is written every
few seconds.
:::

## Converting before uploading

To change the layout of an existing recording, e.g. one recorded with `fastwrite`, rewrite it with `ros2 bag convert`.
It takes a YAML file that describes the output:

```yaml
# convert.yaml
output_bags:
    - uri: recording_chunked # output directory
      storage_id: mcap
      storage_config_uri: mcap_writer_options.yaml # see above; leave out for uncompressed chunks
```

```bash
ros2 bag convert -i recording_fastwrite -o convert.yaml
```

::: danger Don't use rosbag2 compression
`compression_mode` and `compression_format` in the output YAML (or `--compression-mode` when recording) are rosbag2's
own compression, not MCAP chunk compression. `compression_mode: file` compresses the whole file into a `.mcap.zstd`,
which Kleinkram does not accept; the MCAP plugin rejects `compression_mode: message`. Set `compression` in the MCAP
writer options instead.
:::

Without ROS, use the [MCAP CLI](https://mcap.dev/guides/cli). It is a standalone binary, not a Python package:
download it from the [MCAP releases](https://github.com/foxglove/mcap/releases) or install it with
`brew install mcap`.

```bash
# write a copy with compressed chunks
mcap compress recording.mcap -o recording_compressed.mcap
```

`mcap compress --help` lists the options for the compression format and the chunk size. The chunk size is given in
bytes.

## Checking a file before uploading

```bash
mcap info recording.mcap
```

The `compression` line shows how many chunks use which compression, for example
`compression: zstd: [14/14 chunks] [124.89 MB/61.46 MB (50.79%)]`. If there is no chunk information at all, the file
has no chunks.

`mcap doctor recording.mcap` checks the structure of a file. `mcap recover damaged.mcap -o recovered.mcap` rewrites a
damaged or cut-off file, including a new summary section, so that Kleinkram can read it.

## zstd or lz4

Both compress chunks inside the file, and every MCAP library reads both without changes to your code. In
[Foxglove's measurements](https://foxglove.dev/blog/understanding-mcap-chunk-size-and-compression), zstd gave the
better compression ratio and lz4 the faster compression and decompression. Which one is better for your data is best
measured on a real recording.

Larger chunks compress better, but the gains get smaller as the chunk size grows, and a larger chunk means more data
lost in a crash and more data fetched for a partial download.

## Further reading

- [MCAP CLI](https://mcap.dev/guides/cli)
- [rosbag2 MCAP storage plugin](https://github.com/ros2/rosbag2/tree/rolling/rosbag2_storage_mcap): presets and writer
  options
- [Understanding MCAP chunk size and compression](https://foxglove.dev/blog/understanding-mcap-chunk-size-and-compression)
- [MCAP specification](https://mcap.dev/spec)
