export interface LogMessage {
    logTime: bigint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

export const STANDARD_ROS2_DEFINITIONS: Record<string, string> = {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'sensor_msgs/msg/Image': `
std_msgs/Header header
uint32 height
uint32 width
string encoding
uint8 is_bigendian
uint32 step
uint8[] data

================================================================================
MSG: std_msgs/Header
builtin_interfaces/Time stamp
string frame_id

================================================================================
MSG: builtin_interfaces/Time
int32 sec
uint32 nanosec
// eslint-disable-next-line @typescript-eslint/naming-convention
`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'sensor_msgs/msg/CompressedImage': `
std_msgs/Header header
string format
uint8[] data

================================================================================
MSG: std_msgs/Header
builtin_interfaces/Time stamp
string frame_id

================================================================================
MSG: builtin_interfaces/Time
int32 sec
// eslint-disable-next-line @typescript-eslint/naming-convention
uint32 nanosec
`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'sensor_msgs/msg/PointCloud2': `
std_msgs/Header header
uint32 height
uint32 width
PointField[] fields
bool is_bigendian
uint32 point_step
uint32 row_step
uint8[] data
bool is_dense

================================================================================
MSG: std_msgs/Header
builtin_interfaces/Time stamp
string frame_id

================================================================================
MSG: builtin_interfaces/Time
int32 sec
uint32 nanosec

================================================================================
MSG: sensor_msgs/PointField
uint8 INT8=1
uint8 UINT8=2
uint8 INT16=3
uint8 UINT16=4
uint8 INT32=5
uint8 UINT32=6
uint8 FLOAT32=7
uint8 FLOAT64=8
string name
uint32 offset
uint8 datatype
uint32 count
`,
};
