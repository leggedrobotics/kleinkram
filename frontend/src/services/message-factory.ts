import { defineAsyncComponent } from 'vue';

export enum PreviewType {
    IMAGE = 'IMAGE',
    TF = 'TF',
    CAMERA_INFO = 'CAMERA_INFO',
    TWIST = 'TWIST',
    TEMPERATURE = 'TEMPERATURE',
    ROS_LOG = 'ROS_LOG',
    TIME_REFERENCE = 'TIME_REFERENCE',
    POINT_CLOUD = 'POINT_CLOUD',
    STRING = 'STRING',
    JSON = 'JSON',
    IMU = 'IMU',
    GRID_MAP = 'GRID_MAP',
    STATISTICS = 'STATISTICS',
    ODOMETRY = 'ODOMETRY',
    POSE_STAMPED = 'POSE_STAMPED',
    PATH = 'PATH',
    TRANSFORM_STAMPED = 'TRANSFORM_STAMPED',
    NAV_SAT_FIX = 'NAV_SAT_FIX',
    POINT_STAMPED = 'POINT_STAMPED',
    ANYMAL_STATE = 'ANYMAL_STATE',
}

// Lazy load components
const ImageSequenceViewer = defineAsyncComponent(
    () =>
        import('../components/inspect-file/viewers/image-sequence-viewer.vue'),
);
const JsonLogViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/json-log-viewer.vue'),
);
const TfLogViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/tf-log-viewer.vue'),
);
const CameraInfoViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/camera-info-viewer.vue'),
);
const TwistViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/twist-stamped-viewer.vue'),
);
const TemperatureViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/temperature-viewer.vue'),
);
const RosLogViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/ros-log-viewer.vue'),
);
const TimeReferenceViewer = defineAsyncComponent(
    () =>
        import('../components/inspect-file/viewers/time-reference-viewer.vue'),
);
const PointCloudViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/point-cloud-viewer.vue'),
);
const StringViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/string-viewer.vue'),
);
const ImuViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/imu-viewer.vue'),
);
const GridMapViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/grid-map-viewer.vue'),
);
const StatisticsViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/statistics-viewer.vue'),
);
const OdometryViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/odometry-viewer.vue'),
);
const PoseStampedViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/pose-stamped-viewer.vue'),
);
const PathViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/path-viewer.vue'),
);
const TransformStampedViewer = defineAsyncComponent(
    () =>
        import('../components/inspect-file/viewers/transform-stamped-viewer.vue'),
);
const NavSatFixViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/nav-sat-fix-viewer.vue'),
);
const PointStampedViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/point-stamped-viewer.vue'),
);
const AnymalStateViewer = defineAsyncComponent(
    () => import('../components/inspect-file/viewers/anymal-state-viewer.vue'),
);

export const detectPreviewType = (
    messageType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sampleData?: any,

    // eslint-disable-next-line complexity
): PreviewType => {
    const typeLower = messageType.toLowerCase().replace('/msg/', '/');

    // Explicit Matches
    if (typeLower.includes('std_msgs/string')) return PreviewType.STRING; // Explicit
    if (
        typeLower.includes('sensor_msgs/image') ||
        typeLower.includes('sensor_msgs/compressedimage')
    )
        return PreviewType.IMAGE;
    if (typeLower.includes('sensor_msgs/pointcloud2'))
        return PreviewType.POINT_CLOUD;
    if (typeLower.includes('geometry_msgs/twist')) return PreviewType.TWIST;
    if (typeLower.includes('sensor_msgs/camerainfo'))
        return PreviewType.CAMERA_INFO;
    if (typeLower.includes('sensor_msgs/temperature'))
        return PreviewType.TEMPERATURE;
    if (typeLower.includes('rosgraph_msgs/log')) return PreviewType.ROS_LOG;
    if (typeLower.includes('sensor_msgs/timereference'))
        return PreviewType.TIME_REFERENCE;
    if (typeLower === 'tf2_msgs/tfmessage' || typeLower === 'tf/tfmessage')
        return PreviewType.TF;
    if (typeLower.includes('sensor_msgs/imu')) return PreviewType.IMU;
    if (typeLower.includes('grid_map_msgs/gridmap'))
        return PreviewType.GRID_MAP;
    if (typeLower.includes('elevation_map_msgs/statistics'))
        return PreviewType.STATISTICS;
    if (typeLower.includes('nav_msgs/odometry')) return PreviewType.ODOMETRY;
    if (typeLower.includes('geometry_msgs/posestamped'))
        return PreviewType.POSE_STAMPED;
    if (typeLower.includes('nav_msgs/path')) return PreviewType.PATH;
    if (typeLower.includes('geometry_msgs/transformstamped'))
        return PreviewType.TRANSFORM_STAMPED;
    if (typeLower.includes('sensor_msgs/navsatfix'))
        return PreviewType.NAV_SAT_FIX;
    if (typeLower.includes('geometry_msgs/pointstamped'))
        return PreviewType.POINT_STAMPED;
    if (typeLower.includes('anymal_msgs/anymalstate'))
        return PreviewType.ANYMAL_STATE;

    // Heuristics
    if (sampleData) {
        // String Heuristic (simple object with just data: string)
        if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            Object.keys(sampleData).length === 1 &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            typeof sampleData.data === 'string'
        )
            return PreviewType.STRING;

        if ('fields' in sampleData && 'point_step' in sampleData)
            return PreviewType.POINT_CLOUD;
        if ('time_ref' in sampleData && 'source' in sampleData)
            return PreviewType.TIME_REFERENCE;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (sampleData.level && sampleData.file) return PreviewType.ROS_LOG;
        if (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (sampleData.linear && sampleData.angular) ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            sampleData.twist?.linear
        )
            return PreviewType.TWIST;
        if ('temperature' in sampleData && 'variance' in sampleData)
            return PreviewType.TEMPERATURE;
        if (
            'orientation' in sampleData &&
            'angular_velocity' in sampleData &&
            'linear_acceleration' in sampleData
        )
            return PreviewType.IMU;

        const hasDim = 'width' in sampleData && 'height' in sampleData;
        if ('encoding' in sampleData && hasDim) return PreviewType.IMAGE;

        if (
            'info' in sampleData &&
            'layers' in sampleData &&
            'data' in sampleData
        )
            return PreviewType.GRID_MAP;

        if ('pointcloud_process_fps' in sampleData)
            return PreviewType.STATISTICS;

        if (
            'latitude' in sampleData &&
            'longitude' in sampleData &&
            'altitude' in sampleData &&
            'position_covariance' in sampleData
        )
            return PreviewType.NAV_SAT_FIX;

        if (
            'point' in sampleData &&
            'header' in sampleData &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            'x' in sampleData.point &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            'y' in sampleData.point &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            'z' in sampleData.point
        )
            return PreviewType.POINT_STAMPED;

        if (
            'state' in sampleData &&
            'pose' in sampleData &&
            'twist' in sampleData &&
            'joints' in sampleData &&
            'contacts' in sampleData
        )
            return PreviewType.ANYMAL_STATE;
    }

    return PreviewType.JSON;
};

export const getViewerComponent = (type: PreviewType) => {
    const map = {
        [PreviewType.IMAGE]: ImageSequenceViewer,
        [PreviewType.TF]: TfLogViewer,
        [PreviewType.CAMERA_INFO]: CameraInfoViewer,
        [PreviewType.TWIST]: TwistViewer,
        [PreviewType.TEMPERATURE]: TemperatureViewer,
        [PreviewType.ROS_LOG]: RosLogViewer,
        [PreviewType.TIME_REFERENCE]: TimeReferenceViewer,
        [PreviewType.POINT_CLOUD]: PointCloudViewer,
        [PreviewType.STRING]: StringViewer,
        [PreviewType.JSON]: JsonLogViewer,
        [PreviewType.IMU]: ImuViewer,
        [PreviewType.GRID_MAP]: GridMapViewer,
        [PreviewType.STATISTICS]: StatisticsViewer,
        [PreviewType.ODOMETRY]: OdometryViewer,
        [PreviewType.POSE_STAMPED]: PoseStampedViewer,
        [PreviewType.PATH]: PathViewer,
        [PreviewType.TRANSFORM_STAMPED]: TransformStampedViewer,
        [PreviewType.NAV_SAT_FIX]: NavSatFixViewer,
        [PreviewType.POINT_STAMPED]: PointStampedViewer,
        [PreviewType.ANYMAL_STATE]: AnymalStateViewer,
    };
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    return map[type] ?? JsonLogViewer;
};
