# Partial Download

A `.mcap` file carries an index: a summary section that maps topics and log
times onto chunks, and per chunk a message index that gives the offset of every
message. Kleinkram's storage serves HTTP range requests, so the CLI can read
that index and fetch only the messages you asked for, instead of the whole
recording.

```bash
klein download \
  --dest ./slice \
  --start-time 2026-09-18T08:09:00Z \
  --end-time   2026-09-18T08:09:10Z \
  <file>
```

Options can go before or after the file names or ids.

::: tip Summary

- Only `.mcap` files can be sliced. Other files in the selection are skipped
  when `--topics`, `--start-time` or `--end-time` is given.
- How much is saved depends on how the file was written: see
  [What actually saves bandwidth](#what-actually-saves-bandwidth) and
  [MCAP Chunking and Compression](./compression.md).
- The slice is a valid MCAP saved under the original file name.
- To process most of a recording, run an [Action](../actions/use-actions.md)
  instead of downloading it.

:::

::: warning MCAP only
`.bag` and `.db3` have no equivalent index that the client can use over the
network, so they are skipped when any filter is given.
:::

## Look before you download

`klein file inspect` reads only the header and the summary section of a
recording and prints what the file says about itself:

```bash
klein file inspect <file>
```

- topics, with message type, encoding, message count, mean rate and coverage
- the first and last log time, in the format `--start-time` and `--end-time` take
- how the chunks are stored: their count, compression, and whether they are indexed
- attachments and metadata records
- with `--schemas`, the message definitions
- with `--metadata`, the content of the metadata records (one extra request each)

The mean rate (`mean Hz`) is a topic's message count over its own span, from
the first to the last chunk that holds it, so a topic that starts late or stops
early is not rated against the whole recording. A topic found in fewer than five
chunks, such as `/tf_static`, is a one-shot topic and shows `—` instead of a
rate. The coverage column draws the recording in 20 cells, `█` where the topic
has data and `░` where it has none:

```text
 topic        messages  mean Hz  coverage  0:00 ─── 19:26
 /camera        34,980     30.0  ████████████████████
 /lidar          5,820     10.0  ░░░░░░░░██████████░░
 /tf_static          7        —  █░░░░░░░░░░░░░░░░░░░
```

Both come from the chunk index, so their resolution is one chunk: a span starts
and ends at chunk boundaries, not at the first and last message. When any chunk
was written without a message index, the summary does not say which chunks hold
which topics, and the rate and coverage stay empty rather than showing invented
dropouts.

That costs three range requests, whatever the size of the recording. On the
2.15 GB file measured below it is the "read the index only" row: 1.67 MB.

`klein file info` answers from Kleinkram's database, which holds the topic names
extracted at upload. `klein file inspect` answers from the file. Use it to pick
a time window and topics for a slice, or to check that a recording contains
what you need before you start an action on it.

With `--no-verbose` the command prints JSON, with times as nanoseconds. Each
topic carries `first_seen`, `last_seen`, `chunk_count` and `coverage`, a list of
`[start, end]` spans where it has data (all `null` when coverage is unknown):

```bash
klein --no-verbose file inspect <file> | jq '.topics[] | {name, message_count, frequency, coverage}'
```

A recording that was never closed has no summary section and cannot be
inspected this way; the command says so instead of downloading the file. A
summary whose checksum does not match the footer's is refused as corrupt.

## Options

| Option         | Effect                                                 |
| -------------- | ------------------------------------------------------ |
| `--topics`     | Keep only these topics. Repeatable.                    |
| `--start-time` | Drop messages logged before this time. Inclusive.      |
| `--end-time`   | Drop messages logged at or after this time. Exclusive. |
| `--overwrite`  | Replace an existing local file with the slice.         |

Times are ISO 8601 (`2026-09-18T08:08:28Z`), or raw nanoseconds since the epoch
if you already have them. A time without a timezone is read as UTC.

The result is a valid MCAP, with the source profile and the schemas of the kept
topics preserved, so it opens in Foxglove or `ros2 bag` like any other
recording. It is saved under the original file name, so an existing file of
that name is left alone unless you pass `--overwrite`. The slice is written to
a temporary `.part` file first and only renamed once complete, so a failed download never
leaves a truncated file behind.

## What actually saves bandwidth

It depends on how the recording's chunks are stored.

**Uncompressed chunks** (what `ros2 bag record -s mcap` writes without a
preset): every message can be
fetched on its own, so both `--topics` and a time window cut the transfer. What
remains is the index itself — roughly 16 bytes per message in the time range,
for every topic — and the bytes between wanted messages that are close enough
to fetch in one request.

**Compressed chunks**: a chunk is the smallest unit that can be decompressed,
so every chunk holding a wanted message is fetched whole. A time window still
saves bandwidth, because chunks are ordered by log time, but `--topics` alone
usually does not: a chunk normally holds several topics, so one topic appears in
nearly every chunk. The CLI prints a note when `--topics` is used without a
time window.

**No chunks** (the `fastwrite` recording preset): there is no chunk index to
look things up in, so the whole file is read from the start and filtered on
your machine. Neither filter saves bandwidth.

See [MCAP Chunking and Compression](./compression.md) for how to record or
convert files so that they can be sliced.

Measured against a 2.15 GB recording with uncompressed chunks (521 774
messages, 10 topics, 192 s):

| Request                        | Transferred         | Output file | Time  |
| ------------------------------ | ------------------- | ----------- | ----- |
| Read the index only            | 1.67 MB (0.08%)     | —           | <1 s  |
| 10 s window, all topics        | 115.1 MB (5.4%)     | 64.2 MB     | 10 s  |
| 10 s window, `/rosout`         | 2.6 MB (0.12%)      | < 0.1 MB    | 4 s   |
| `/rosout`, no time window      | **19.3 MB (0.90%)** | 0.44 MB     | 58 s  |
| `/rosout`, whole-chunk reading | 2124.6 MB (98.9%)   | 0.44 MB     | 309 s |

The last row is what the same request costs when chunks have to be fetched
whole, as with compressed chunks. A topic filter over a whole recording is
latency-bound rather than bandwidth-bound — about 2 600 small requests — so it
takes longer than its byte count suggests.

## From Python

The SDK takes the same filters:

```python
import kleinkram

kleinkram.download(
    file_ids=["38d7e53e-64d6-434e-a21a-f02017dc6290"],
    dest="./slice",
    start_time=1789718940000000000,   # nanoseconds, as in MCAP log times
    end_time=1789718950000000000,
    topics=["/imu/data_raw"],
)
```

Passing any of `topics`, `start_time` or `end_time` switches to a partial
download; non-MCAP files in the selection are skipped, and `overwrite=True` is
needed to replace an existing local file.

`inspect_file` returns the summary as a `McapInfo`, whose times can be passed
straight on:

```python
info = kleinkram.inspect_file("38d7e53e-64d6-434e-a21a-f02017dc6290")

print(info.duration, [t.name for t in info.topics])
kleinkram.download(
    file_ids=["38d7e53e-64d6-434e-a21a-f02017dc6290"],
    dest="./slice",
    topics=["/rosout"],
    start_time=info.start_time,
    end_time=info.start_time + 10 * 10**9,
)
```

To slice where a topic actually has data, start from its own span:

```python
lidar = next(t for t in info.topics if t.name == "/lidar")
if lidar.first_seen is not None:   # None when the chunks carry no message index
    start_time, end_time = lidar.first_seen, lidar.last_seen + 1   # end_time is exclusive
```

## When to slice and when not to

Slicing is the right tool when you want a specific interval or a few topics on
your own machine — a manoeuvre to inspect in Foxglove, a few seconds around an
incident, the log output of a run.

It is the wrong tool for analysing most of a recording. If the selection is
most of the file, transferring it is worse than not transferring it at all: run
a [Kleinkram Action](../actions/use-actions.md) instead, which executes inside
the cluster next to the storage and never moves the data.
