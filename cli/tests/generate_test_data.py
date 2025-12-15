from __future__ import annotations

import os
import struct
import time

from rosbags.rosbag1 import Writer


def serialize_string(data):
    """Serialize a string for ROS1 (std_msgs/String)."""
    encoded = data.encode("utf-8")
    return struct.pack("<I", len(encoded)) + encoded


def serialize_time(secs, nsecs):
    return struct.pack("<II", secs, nsecs)


def serialize_header(seq, secs, nsecs, frame_id):
    return struct.pack("<I", seq) + serialize_time(secs, nsecs) + serialize_string(frame_id)


def serialize_log(seq, secs, nsecs, frame_id, level, name, msg, file, function, line, topics):
    # rosgraph_msgs/Log
    # Header header
    # byte level
    # string name
    # string msg
    # string file
    # string function
    # uint32 line
    # string[] topics
    data = serialize_header(seq, secs, nsecs, frame_id)
    data += struct.pack("<b", level)
    data += serialize_string(name)
    data += serialize_string(msg)
    data += serialize_string(file)
    data += serialize_string(function)
    data += struct.pack("<I", line)
    data += struct.pack("<I", len(topics))
    for t in topics:
        data += serialize_string(t)
    return data


def serialize_temperature(seq, secs, nsecs, frame_id, temp, variance):
    # sensor_msgs/Temperature
    # Header header
    # float64 temperature
    # float64 variance
    data = serialize_header(seq, secs, nsecs, frame_id)
    data += struct.pack("<dd", temp, variance)
    return data


def serialize_time_reference(seq, secs, nsecs, frame_id, ref_secs, ref_nsecs, source):
    # sensor_msgs/TimeReference
    # Header header
    # time time_ref
    # string source
    data = serialize_header(seq, secs, nsecs, frame_id)
    data += serialize_time(ref_secs, ref_nsecs)
    data += serialize_string(source)
    return data


def serialize_twist_stamped(seq, secs, nsecs, frame_id, linear, angular):
    # geometry_msgs/TwistStamped
    # Header header
    # Twist twist (Vector3 linear, Vector3 angular)
    data = serialize_header(seq, secs, nsecs, frame_id)
    data += struct.pack("<ddd", linear[0], linear[1], linear[2])
    data += struct.pack("<ddd", angular[0], angular[1], angular[2])
    return data


def serialize_tf_message(transforms):
    # tf2_msgs/TFMessage
    # geometry_msgs/TransformStamped[] transforms
    data = struct.pack("<I", len(transforms))
    for t in transforms:
        # TransformStamped
        # Header header
        # string child_frame_id
        # Transform transform (Vector3 translation, Quaternion rotation)
        data += serialize_header(t["seq"], t["secs"], t["nsecs"], t["frame_id"])
        data += serialize_string(t["child_frame_id"])
        data += struct.pack("<ddd", t["tx"], t["ty"], t["tz"])
        data += struct.pack("<dddd", t["rx"], t["ry"], t["rz"], t["rw"])
    return data


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

    print(f"Generating {filename} (~{target_size} bytes) with {num_msgs} messages of payload {payload_size}...")

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


def generate_frontend_bag(filename):
    print(f"Generating frontend test bag: {filename}")
    if os.path.exists(filename):
        os.remove(filename)

    with Writer(filename) as writer:
        # 1. rosgraph_msgs/Log
        conn_log = writer.add_connection(
            topic="/rosout",
            msgtype="rosgraph_msgs/msg/Log",
            msgdef="Header header\nbyte level\nstring name\nstring msg\nstring file\nstring function\nuint32 "
            "line\nstring[] topics\n================================================================================\n"
            "MSG: std_msgs/Header\nuint32 seq\ntime stamp\nstring frame_id",
            md5sum="acffd30cd6b6de30f120938c17c593fb",
        )
        # 2. sensor_msgs/Temperature
        conn_temp = writer.add_connection(
            topic="/sensors/temperature",
            msgtype="sensor_msgs/msg/Temperature",
            msgdef="Header header\nfloat64 temperature\nfloat64 variance"
            "\n================================================================================\n"
            "MSG: std_msgs/Header\nuint32 seq\ntime stamp\nstring frame_id",
            md5sum="ff71b307acdbe7c871a5a6d7edce2f6e",
        )
        # 3. sensor_msgs/TimeReference
        conn_time = writer.add_connection(
            topic="/time_ref",
            msgtype="sensor_msgs/msg/TimeReference",
            msgdef="Header header\ntime time_ref\nstring source\n"
            "================================================================================\n"
            "MSG: std_msgs/Header\nuint32 seq\ntime stamp\nstring frame_id",
            md5sum="fded64a0265108ba86c3d38fb11c0c16",
        )
        # 4. geometry_msgs/TwistStamped
        conn_twist = writer.add_connection(
            topic="/cmd_vel",
            msgtype="geometry_msgs/msg/TwistStamped",
            msgdef="Header header\ngeometry_msgs/Twist twist\n"
            "================================================================================\n"
            "MSG: std_msgs/Header\nuint32 seq\ntime stamp\nstring frame_id\n"
            "================================================================================\n"
            "MSG: geometry_msgs/Twist\nVector3 linear\nVector3 angular\n"
            "================================================================================\n"
            "MSG: geometry_msgs/Vector3\nfloat64 x\nfloat64 y\nfloat64 z",
            md5sum="98d34b0043a2093cf9d9345ab6eef12e",
        )
        # 5. tf2_msgs/TFMessage
        conn_tf = writer.add_connection(
            topic="/tf",
            msgtype="tf2_msgs/msg/TFMessage",
            msgdef="geometry_msgs/TransformStamped[] transforms\n"
            "================================================================================\n"
            "MSG: geometry_msgs/TransformStamped\nHeader header\nstring child_frame_id\n"
            "geometry_msgs/Transform transform\n"
            "================================================================================\n"
            "MSG: std_msgs/Header\nuint32 seq\ntime stamp\nstring frame_id\n"
            "================================================================================\n"
            "MSG: geometry_msgs/Transform\ngeometry_msgs/Vector3 translation\n"
            "geometry_msgs/Quaternion rotation\n"
            "================================================================================\n"
            "MSG: geometry_msgs/Vector3\nfloat64 x\nfloat64 y\nfloat64 z\n"
            "================================================================================\n"
            "MSG: geometry_msgs/Quaternion\nfloat64 x\nfloat64 y\nfloat64 z\nfloat64 w",
            md5sum="94810edda583a504dfda3829e70d7eec",
        )

        # Write messages
        for i in range(100):
            timestamp = 1000 + i * 100000000  # 100ms steps
            secs = int(timestamp / 1000000000)
            nsecs = timestamp % 1000000000

            # Log
            writer.write(
                conn_log,
                timestamp,
                serialize_log(
                    i,
                    secs,
                    nsecs,
                    "",
                    2,
                    "test_node",
                    f"Log message {i}",
                    "test.cpp",
                    "main",
                    i,
                    ["/rosout"],
                ),
            )

            # Temperature (sine wave)
            import math

            temp = 20.0 + 5.0 * math.sin(i * 0.1)
            writer.write(
                conn_temp,
                timestamp,
                serialize_temperature(i, secs, nsecs, "sensor_frame", temp, 0.1),
            )

            # TimeReference
            writer.write(
                conn_time,
                timestamp,
                serialize_time_reference(i, secs, nsecs, "time_frame", secs, nsecs, "GPS"),
            )

            # TwistStamped (circle)
            writer.write(
                conn_twist,
                timestamp,
                serialize_twist_stamped(i, secs, nsecs, "base_link", [1.0, 0.0, 0.0], [0.0, 0.0, 0.5]),
            )

            # TF
            writer.write(
                conn_tf,
                timestamp,
                serialize_tf_message(
                    [
                        {
                            "seq": i,
                            "secs": secs,
                            "nsecs": nsecs,
                            "frame_id": "map",
                            "child_frame_id": "base_link",
                            "tx": i * 0.1,
                            "ty": 0.0,
                            "tz": 0.0,
                            "rx": 0.0,
                            "ry": 0.0,
                            "rz": 0.0,
                            "rw": 1.0,
                        }
                    ]
                ),
            )


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
    backend_fixtures_dir = os.path.join(os.path.dirname(__file__), "../../backend/tests/fixtures")
    os.makedirs(backend_fixtures_dir, exist_ok=True)
    generate_bag(os.path.join(backend_fixtures_dir, "test.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "to_delete.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "file1.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "file2.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "move_me.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "move_me.bag"), 10 * 1024)
    generate_bag(os.path.join(backend_fixtures_dir, "state_test.bag"), 10 * 1024)
    generate_frontend_bag(os.path.join(data_dir, "frontend_test.bag"))

    # Generate dummy MCAP and YAML
    with open(os.path.join(data_dir, "test.yaml"), "w") as f:
        f.write("test: true\nvalue: 123\n")

    with open(os.path.join(data_dir, "test.mcap"), "wb") as f:
        f.write(b"\x89MCAP\x30\r\n")  # Minimal magic bytes

    print("Done.")


if __name__ == "__main__":
    main()
