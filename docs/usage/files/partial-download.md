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

Options go before the file names or ids.

::: warning MCAP only
Only `.mcap` can be sliced. `.bag` and `.db3` have no equivalent index that the
client can use over the network, so they are skipped when any filter is given.
:::

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

**Uncompressed chunks** (what our recorders write): every message can be
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

## When to slice and when not to

Slicing is the right tool when you want a specific interval or a few topics on
your own machine — a manoeuvre to inspect in Foxglove, a few seconds around an
incident, the log output of a run.

It is the wrong tool for analysing most of a recording. If the selection is
most of the file, transferring it is worse than not transferring it at all: run
a [Kleinkram Action](../actions/use-actions.md) instead, which executes inside
the cluster next to the storage and never moves the data.
