import os
import time
import struct
from rosbags.rosbag1 import Writer


def serialize_string(data):
    """Serialize a string for ROS1 (std_msgs/String)."""
    # std_msgs/String is just the string data prefixed by 4-byte length
    encoded = data.encode("utf-8")
    return struct.pack("<I", len(encoded)) + encoded


def generate_bag(filename, target_size):
    # Adjust payload to be smaller for small files
    payload_size = 1024
    if target_size > 1024 * 1024:
        payload_size = 1024 * 1024

    if target_size < 2000:  # Very small files
        payload_size = 100

    payload = "x" * payload_size
    serialized_msg = serialize_string(payload)

    # Calculate number of messages needed
    # Approximate overhead per message in bag file is ~30-50 bytes (record header) + connection ref
    # We'll assume overhead is small compared to payload for large files, but significant for small ones.
    # We'll just write until we think we are close.

    msg_size = len(serialized_msg) + 50  # rough estimate including record headers
    num_msgs = int(target_size / msg_size) + 1
    if num_msgs < 1:
        num_msgs = 1

    print(
        f"Generating {filename} (~{target_size} bytes) with {num_msgs} messages of payload {payload_size}..."
    )

    if os.path.exists(filename):
        os.remove(filename)

    with Writer(filename) as writer:
        # Add a connection
        # msg_def for std_msgs/String is just "string data"
        conn = writer.add_connection(
            topic="/test_topic",
            msgtype="std_msgs/msg/String",
            msgdef="string data",
            md5sum="992ce8a1687cec8c8bd883ec73ca41d1",
        )
        timestamp = 1000
        for i in range(num_msgs):
            writer.write(conn, timestamp + i, serialized_msg)


def main():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)

    files = {
        "10_KB.bag": 10 * 1024,
        "50_KB.bag": 50 * 1024,
        "1_MB.bag": 1 * 1024 * 1024,
        "17_MB.bag": 17 * 1024 * 1024,
        "125_MB.bag": 125 * 1024 * 1024,
    }

    for filename, size in files.items():
        filepath = os.path.join(data_dir, filename)
        generate_bag(filepath, size)

    # Generate backend fixtures
    backend_fixtures_dir = os.path.join(
        os.path.dirname(__file__), "../../backend/tests/fixtures"
    )
    os.makedirs(backend_fixtures_dir, exist_ok=True)
    generate_bag(os.path.join(backend_fixtures_dir, 'test.bag'), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, 'to_delete.bag'), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, 'file1.bag'), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, 'file2.bag'), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, 'move_me.bag'), 10 * 1024)

    print("Done.")


if __name__ == "__main__":
    main()
