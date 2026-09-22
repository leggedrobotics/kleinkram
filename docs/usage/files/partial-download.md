# Partial Download

A `.mcap` file carries an index: a summary section that maps topics and log
times onto byte ranges inside the file. Kleinkram's storage serves HTTP range
requests, so the CLI can read that index and fetch only the chunks holding the
messages you asked for, instead of the whole recording.

```bash
klein download <file> \
  --dest ./slice \
  --start-time 2026-09-18T08:08:28Z \
  --end-time   2026-09-18T08:08:38Z
```

::: warning MCAP only
Only `.mcap` can be sliced. `.bag` and `.db3` have no equivalent index that the
client can use over the network, so they are skipped when any filter is given.
:::

## Options

| Option         | Effect                                                 |
| -------------- | ------------------------------------------------------ |
| `--topics`     | Keep only these topics. Repeatable.                    |
| `--start-time` | Drop messages logged before this time.                 |
| `--end-time`   | Drop messages logged at or after this time. Exclusive. |

Times are ISO 8601 (`2026-09-18T08:08:28Z`), or raw nanoseconds since the epoch
if you already have them. A time without a timezone is read as UTC.

The result is a valid MCAP, with the source profile and the schemas of the kept
topics preserved, so it opens in Foxglove or `ros2 bag` like any other
recording.

## What actually saves bandwidth

This is the part worth understanding before relying on it.

**Time filtering saves bandwidth. Topic filtering usually does not.** MCAP
chunks are ordered by log time, so a time window maps onto a contiguous stretch
of the file. But a chunk normally holds _several topics interleaved_, and a
chunk is the smallest unit that can be fetched and decompressed — so asking for
one topic still pulls every chunk that topic appears in, which is typically all
of them.

Measured against a 2.15 GB recording (521 774 messages, 10 topics, 192 s):

| Request                   | Transferred           | Output file | Time  |
| ------------------------- | --------------------- | ----------- | ----- |
| Read the index only       | **1.67 MB** (0.08%)   | —           | 0.1 s |
| 10 s window, all topics   | 118.1 MB (5.5%)       | 62.81 MB    | 26 s  |
| 10 s window, one topic    | 117.0 MB (5.4%)       | 0.24 MB     | 24 s  |
| One topic, no time window | **2124.6 MB (98.9%)** | 5.06 MB     | 309 s |

The last row is the trap: filtering to a single low-rate topic across a whole
recording transfers essentially the entire file. `--topics` is still useful — it
makes the _written_ file small and quick to parse — but combine it with a time
window if the goal is to transfer less.

The CLI prints a warning when `--topics` is used without a time window.

## From Python

The SDK takes the same filters:

```python
import kleinkram

kleinkram.download(
    file_ids=["38d7e53e-64d6-434e-a21a-f02017dc6290"],
    dest="./slice",
    start_time=1789718908373212789,   # nanoseconds, as in MCAP log times
    end_time=1789718918373212789,
    topics=["/imu/data_raw"],
)
```

Passing any of `topics`, `start_time` or `end_time` switches to a partial
download; non-MCAP files in the selection are skipped.

## When to slice and when not to

Slicing is the right tool when you want a specific interval on your own machine
— a manoeuvre to inspect in Foxglove, a few seconds around an incident.

It is the wrong tool for analysing a whole recording. Transferring 98% of a file
to compute over it is worse than not transferring it at all: run a
[Kleinkram Action](../actions/use-actions.md) instead, which executes inside the
cluster next to the storage and never moves the data.
