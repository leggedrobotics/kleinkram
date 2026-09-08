export interface LogMessage {
    logTime: bigint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any;
}

export interface ReadOptions {
    /** Keep only every n-th message of the topic (1 = keep all). */
    stride?: number;
    /**
     * Read the file's chunks coarse-to-fine (first, last, middle, quarters,
     * ...) instead of front-to-back, so that a preview covering the whole
     * recording appears after the first few chunks and refines as more data
     * streams in. Messages are then emitted out of time order.
     */
    progressive?: boolean;
}

/**
 * Returns the indices 0..count-1 in a coarse-to-fine order: the two ends
 * first, then the middle, then the quarter points, and so on. Reading
 * chunks in this order makes partial data cover the whole time range.
 */
export const coarseToFineOrder = (count: number): number[] => {
    if (count <= 0) return [];
    if (count === 1) return [0];
    const order: number[] = [0, count - 1];
    const taken = new Set(order);
    // Breadth-first bisection of the remaining intervals
    const queue: [number, number][] = [[0, count - 1]];
    while (queue.length > 0) {
        const interval = queue.shift();
        if (!interval) break;
        const [low, high] = interval;
        if (high - low < 2) continue;
        const mid = Math.floor((low + high) / 2);
        if (!taken.has(mid)) {
            taken.add(mid);
            order.push(mid);
        }
        queue.push([low, mid], [mid, high]);
    }
    return order;
};

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
