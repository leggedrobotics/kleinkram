import sys
import os
import csv
from mcap.reader import make_reader


def convert_to_csv(data_dir, output_dir):
    for filename in os.listdir(data_dir):
        if filename.endswith(".mcap"):
            filepath = os.path.join(data_dir, filename)
            try:
                with open(filepath, "rb") as f:
                    reader = make_reader(f)
                    summary = reader.get_summary()
                    if not summary:
                        continue

                    # Create a CSV file for each topic
                    for channel_id, channel in summary.channels.items():
                        topic_name = channel.topic.replace("/", "_")
                        if topic_name.startswith("_"):
                            topic_name = topic_name[1:]

                        csv_filename = f"{filename}_{topic_name}.csv"
                        csv_filepath = os.path.join(output_dir, csv_filename)

                        with open(csv_filepath, "w", newline="") as csvfile:
                            writer = csv.writer(csvfile)
                            writer.writerow(["timestamp", "data_size"])  # Simplified header

                            # Note: This is a simplified example.
                            # Real conversion would need to handle message decoding based on schema.
                            # Here we just dump the raw bytes size for demonstration.

                            # Re-read to iterate messages
                            f.seek(0)
                            reader = make_reader(f)
                            for schema, channel, message in reader.iter_messages(topics=[channel.topic]):
                                writer.writerow([message.log_time, len(message.data)])

            except Exception as e:
                print(f"Error converting {filename}: {e}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert.py <data_dir> <output_dir>")
        sys.exit(1)

    import subprocess

    subprocess.run(["klein", "--version"])

    convert_to_csv(sys.argv[1], sys.argv[2])
