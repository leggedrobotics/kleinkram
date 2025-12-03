import sys
import os
import json
from mcap.reader import make_reader


def extract_metadata(data_dir, output_file):
    metadata = {}
    for filename in os.listdir(data_dir):
        if filename.endswith(".mcap"):
            filepath = os.path.join(data_dir, filename)
            try:
                with open(filepath, "rb") as f:
                    reader = make_reader(f)
                    summary = reader.get_summary()
                    if summary:
                        metadata[filename] = {
                            "stats": {
                                "message_count": summary.statistics.message_count,
                                "channel_count": summary.statistics.channel_count,
                                "attachment_count": summary.statistics.attachment_count,
                                "chunk_count": summary.statistics.chunk_count,
                                "message_start_time": summary.statistics.message_start_time,
                                "message_end_time": summary.statistics.message_end_time,
                            },
                            "channels": [{"topic": c.topic, "schema": c.schema_name} for c in summary.channels.values()],
                        }
            except Exception as e:
                print(f"Error reading {filename}: {e}")

    with open(output_file, "w") as f:
        json.dump(metadata, f, indent=2)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python metadata.py <data_dir> <output_file>")
        sys.exit(1)

    import subprocess

    subprocess.run(["klein", "--version"])

    extract_metadata(sys.argv[1], sys.argv[2])
