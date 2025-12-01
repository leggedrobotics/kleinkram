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

export const detectPreviewType = (
    messageType: string,
    sampleData?: any,
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

    // Heuristics
    if (sampleData) {
        // String Heuristic (simple object with just data: string)
        if (
            Object.keys(sampleData).length === 1 &&
            typeof sampleData.data === 'string'
        )
            return PreviewType.STRING;

        if ('fields' in sampleData && 'point_step' in sampleData)
            return PreviewType.POINT_CLOUD;
        if ('time_ref' in sampleData && 'source' in sampleData)
            return PreviewType.TIME_REFERENCE;
        if (sampleData.level && sampleData.file) return PreviewType.ROS_LOG;
        if (
            (sampleData.linear && sampleData.angular) ||
            sampleData.twist?.linear
        )
            return PreviewType.TWIST;
        if ('temperature' in sampleData && 'variance' in sampleData)
            return PreviewType.TEMPERATURE;

        const hasDim = 'width' in sampleData && 'height' in sampleData;
        if ('encoding' in sampleData && hasDim) return PreviewType.IMAGE;
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
    };
    return map[type] ?? JsonLogViewer;
};
