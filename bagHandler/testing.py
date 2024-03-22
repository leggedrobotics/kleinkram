import sys

# from mcap_ros1.decoder import DecoderFactory

from mcap_ros1.reader import make_reader, read_ros1_messages


def main():
    with open("/home/zivi/Downloads/2024-02-08-11-18-53_lpc_imu_0.bag", "rb") as f:
        for schema, channel, message, ros_msg in read_ros1_messages(f):
            print(f"{channel.topic} {schema.name} [{message.log_time}]: {ros_msg}")


if __name__ == "__main__":
    main()