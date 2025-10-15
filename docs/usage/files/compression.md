# MCAP File Compression Best Practices

This guide explains how to efficiently compress MCAP files for storage in Kleinkram while maintaining optimal performance for data access and processing.

## TL;DR

✅ **DO**: Use MCAP's built-in chunk compression
❌ **DON'T**: Compress entire files with `.zst` or `.gz`

## Why MCAP Chunk Compression?

MCAP files support internal **chunk-level compression** that provides:

- **Storage savings**: 3-5x smaller files
- **Random access**: Read specific topics without decompressing everything
- **Transparent decompression**: Libraries handle it automatically
- **Industry standard**: Recommended by Foxglove and ROS 2 community

## Recommended Workflow

### On the Robot

Record with the `fastwrite` profile for maximum performance during data collection:

```bash
ros2 bag record --storage mcap --storage-preset-profile fastwrite \
    /camera/image /imu/data /lidar/scan
```

**What this does:**
- Writes uncompressed data for speed
- Minimal CPU usage during recording
- No CRC calculation (faster writes)
- No message index (added later)

### Post-Processing (Offline)

After recording, compress the files before uploading to Kleinkram:

```bash
# Add chunk compression and message index
ros2 bag convert input.mcap -o output.mcap \
    --output-options "compression_mode=file,compression_format=zstd"
```

**Alternative using MCAP CLI:**

```bash
# Install MCAP CLI
pip install mcap-cli

# Compress with zstd (recommended)
mcap compress input.mcap --compression zstd --chunk-size 4MB

# Or use LZ4 for faster decompression
mcap compress input.mcap --compression lz4 --chunk-size 4MB
```

### Upload to Kleinkram

```bash
# Upload compressed MCAP (file extension is still .mcap)
klein upload output.mcap --mission "my-mission" --project "my-project"
```

## Compression Formats

MCAP supports two compression algorithms:

### Zstd (Recommended)

```bash
mcap compress input.mcap --compression zstd
```

**Pros:**
- Best compression ratios (3-5x savings)
- Good decompression speed
- Industry standard

**Use when:** Storage cost is a priority

### LZ4 (Alternative)

```bash
mcap compress input.mcap --compression lz4
```

**Pros:**
- Faster decompression (~2x faster than zstd)
- Still good compression (2-3x savings)

**Use when:** Decompression speed is critical

## Storage Preset Profiles

ROS 2 provides several preset profiles for different scenarios:

### `fastwrite` (Recording)
Best for on-robot recording:
```bash
ros2 bag record --storage mcap --storage-preset-profile fastwrite <topics>
```
- No compression
- No CRC
- No message index
- Minimal CPU/memory usage

### `zstd_small` (Balanced)
Good balance of speed and compression:
```bash
ros2 bag record --storage mcap --storage-preset-profile zstd_small <topics>
```
- Zstd compression (lowest ratio)
- No CRC calculation
- Good throughput

### `zstd_fast` (Maximum Compression)
Best compression, slower writes:
```bash
ros2 bag record --storage mcap --storage-preset-profile zstd_fast <topics>
```
- Zstd compression (highest ratio)
- 4MB chunks
- Maximum storage savings

## Chunk Size Configuration

Larger chunk sizes generally provide better compression:

```bash
# Small chunks (good for random access)
mcap compress input.mcap --compression zstd --chunk-size 1MB

# Medium chunks (balanced - recommended)
mcap compress input.mcap --compression zstd --chunk-size 4MB

# Large chunks (best compression)
mcap compress input.mcap --compression zstd --chunk-size 8MB
```

**Recommendation:** Use 4MB chunks for a good balance of compression ratio and read performance.

## What NOT to Do

### ❌ File-Level Compression

**Don't compress entire MCAP files:**

```bash
# ❌ BAD - loses random access
zstd data.mcap           # Creates data.mcap.zst
gzip data.mcap           # Creates data.mcap.gz
```

**Why this is problematic:**
- Cannot read specific topics without full decompression
- Actions must decompress entire file (slow, lots of disk I/O)
- Not the standard practice in the community
- Kleinkram can't extract topic metadata without decompression

## How Kleinkram Handles Compressed Files

When you upload a chunk-compressed MCAP:

1. **Upload**: File uploaded directly to storage (already compressed)
2. **Topic Extraction**: Kleinkram's queue consumer:
   - Downloads the file
   - MCAP library automatically decompresses chunks as needed
   - Extracts topic metadata (names, types, message counts, frequencies)
   - Stores metadata in database
3. **Storage**: Compressed MCAP stored as-is
4. **Actions**: Your action containers:
   - Download compressed MCAP
   - MCAP libraries handle decompression transparently
   - Can efficiently read specific topics (random access works!)

## Verifying Compression

Check if your MCAP is compressed:

```bash
# Using MCAP CLI
mcap info data.mcap

# Look for:
# compression: zstd (or lz4)
# chunk count: > 0
```

Example output:
```
library:
profile:
messages: 45123
duration: 1m23.456s
start: 2024-01-15T10:30:00Z
end: 2024-01-15T10:31:23Z
compression: zstd
chunk count: 42
```

## Performance Comparison

Example with a 10 GB dataset:

| Method | File Size | Upload Time | Storage Cost | Action Access |
|--------|-----------|-------------|--------------|---------------|
| Uncompressed | 10 GB | Slow | High (1x) | Fast ✅ |
| Chunk Compressed (zstd) | 2 GB | Fast | Low (5x savings) | Fast ✅ |
| File-level .zst | 2 GB | Fast | Low (5x savings) | Slow ❌ |

## FAQs

### Q: Do I need to decompress chunk-compressed MCAPs before uploading?

**A:** No! Upload them directly. Kleinkram's libraries handle decompression automatically.

### Q: Will my actions need to decompress files?

**A:** No! MCAP libraries (`@mcap/core`, Python `mcap`, C++ `mcap`, etc.) handle decompression transparently. Your action code doesn't change.

### Q: Can I still seek to specific timestamps/topics?

**A:** Yes! Chunk compression maintains the MCAP index, so random access works perfectly.

### Q: What if I have `.mcap.zst` files?

**A:** These are file-level compressed. Consider recompressing with chunk compression:

```bash
# Decompress
zstd -d data.mcap.zst

# Recompress with chunk compression
mcap compress data.mcap --compression zstd --chunk-size 4MB
```

### Q: Can I compress during recording?

**A:** Yes, but it may impact recording performance on resource-constrained robots. Use `--storage-preset-profile zstd_small` for real-time compression with minimal overhead.

## Additional Resources

- [MCAP Specification](https://mcap.dev/spec)
- [Understanding MCAP Chunk Size and Compression](https://foxglove.dev/blog/understanding-mcap-chunk-size-and-compression)
- [ROS 2 rosbag2_storage_mcap Documentation](https://docs.ros.org/en/humble/p/rosbag2_storage_mcap/)
- [MCAP CLI Tools](https://github.com/foxglove/mcap/tree/main/python/mcap-cli)

## Summary

For optimal performance with Kleinkram:

1. ✅ Record with `fastwrite` profile on robot
2. ✅ Post-process with `mcap compress` or `ros2 bag convert`
3. ✅ Upload chunk-compressed `.mcap` files
4. ✅ Enjoy fast uploads, storage savings, and efficient actions
5. ❌ Don't use file-level `.zst` or `.gz` compression
