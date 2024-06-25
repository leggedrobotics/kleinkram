import {faker} from '@faker-js/faker';
import {FileType} from "./enum";

/**
 * A modified faker implementation that provides
 * helper methods to create camp, meals, and recipes.
 */
type ExtendedFaker = typeof faker & {
    ros: {
        topic: () => string;
        topicType: () => string;
        fileType: () => FileType;
        fileName: (type: FileType) => string;
    };
    mission: {
        name: () => string;
    };
    project: {
        name: () => string;
    };
};

const ros_topic_names = [
    'chatter',
    'cmd_vel',
    'diagnostics',
    'imu',
    'joint_states',
    'odom',
    'rosout',
    'rosout_agg',
    'tf',
    'tf_static',
    '/anymal_low_level_controller/actuator_readings',
    '/anymal_low_level_controller/actuator_readings_extended_throttled',
    '/anymal_low_level_controller/actuator_readings_throttled',
    '/anymal_low_level_controller/actuator_setpoints',
    '/motion_reference/command_twist',
    '/sensors/battery_voltage',
    '/state_estimator/actuator_readings',
    '/state_estimator/anymal_state',
    '/state_estimator/contact_force_lf_foot',
    '/state_estimator/contact_force_lh_foot',
    '/state_estimator/contact_force_rf_foot',
    '/state_estimator/contact_force_rh_foot',
    '/state_estimator/pose_in_odom',
    '/state_estimator/twist',
    '/depth_camera_front_lower/interface_status',
    '/depth_camera_front_upper/interface_status',
    '/depth_camera_front_upper/point_cloud_self_filtered',
    '/depth_camera_left/interface_status',
    '/depth_camera_left/point_cloud_self_filtered',
    '/depth_camera_rear_lower/interface_status',
    '/depth_camera_rear_upper/interface_status',
    '/depth_camera_rear_upper/point_cloud_self_filtered',
    '/depth_camera_right/interface_status',
    '/depth_camera_right/point_cloud_self_filtered',
    '/lidar/point_cloud',
    '/elevation_mapping/elevation_map_raw',
    '/elevation_mapping/semantic_map_raw',
    '/point_cloud_filter/lidar/point_cloud_filtered',
    '/wide_angle_camera_front/camera_info',
    '/wide_angle_camera_front/image_color/compressed',
    '/wide_angle_camera_front/image_color/compressed/parameter_descriptions',
    '/wide_angle_camera_front/image_color/compressed/parameter_updates',
    '/wide_angle_camera_front/image_color_small/camera_info',
    '/wide_angle_camera_rear/camera_info',
    '/wide_angle_camera_rear/image_color/compressed',
    '/wide_angle_camera_rear/image_color/compressed/parameter_descriptions',
    '/wide_angle_camera_rear/image_color/compressed/parameter_updates',
    '/wide_angle_camera_rear/image_color_small/camera_info',
    '/wild_anomaly_detection/bin_img',
    '/camera_front/depth',
    '/camera_front/rgb',
    '/camera_front/rgb/compressed',
    '/camera_front/rgb/compressedDepth',
    '/camera_front/rgb/theora',
    '/camera_rear/depth',
    '/camera_rear/rgb',
    '/camera_rear/rgb/compressed',
    '/camera_rear/rgb/compressedDepth',
    '/camera_rear/rgb/theora',
    '/sonar_front',
    '/sonar_rear',
    '/ultrasonic_front',
    '/ultrasonic_rear',
    '/gps/fix',
    '/gps/vel',
    '/lidar/front_scan',
    '/lidar/rear_scan',
    '/radar/front',
    '/radar/rear',
    '/radar/left',
    '/radar/right',
    '/robot_state',
    '/battery_state',
    '/temperature_state',
    '/pressure_state',
    '/humidity_state',
    '/altimeter',
    '/air_quality',
    '/wind_speed',
    '/wind_direction',
    '/light_intensity',
    '/proximity_sensor/front',
    '/proximity_sensor/rear',
    '/proximity_sensor/left',
    '/proximity_sensor/right',
    '/obstacle_detection/front',
    '/obstacle_detection/rear',
    '/obstacle_detection/left',
    '/obstacle_detection/right',
    '/velocity_controller/cmd_vel',
    '/position_controller/cmd_pos',
    '/path_planner/path',
    '/path_planner/waypoints',
    '/localization/pose',
    '/localization/twist',
    '/map',
    '/map_updates',
    '/costmap',
    '/costmap_updates',
    '/trajectory',
    '/trajectory_updates'
];

const ros_topic_types = [
    'std_msgs/String',
    'geometry_msgs/Twist',
    'diagnostic_msgs/DiagnosticArray',
    'sensor_msgs/Imu',
    'sensor_msgs/JointState',
    'nav_msgs/Odometry',
    'rosgraph_msgs/Log',
    'tf2_msgs/TFMessage',
    'anymal_msgs/ActuatorReadings',
    'anymal_msgs/ActuatorReadingsExtended',
    'anymal_msgs/ActuatorSetpoints',
    'sensor_msgs/BatteryState',
    'anymal_msgs/AnymalState',
    'geometry_msgs/WrenchStamped',
    'geometry_msgs/PoseWithCovarianceStamped',
    'geometry_msgs/TwistWithCovarianceStamped',
    'sensor_msgs/PointCloud2',
    'sensor_msgs/Image',
    'dynamic_reconfigure/ConfigDescription',
    'dynamic_reconfigure/Config',
    'sensor_msgs/CameraInfo',
    'sensor_msgs/CompressedImage',
    'theora_image_transport/Packet',
    'sensor_msgs/Range',
    'sensor_msgs/NavSatFix',
    'geometry_msgs/TwistStamped',
    'sensor_msgs/LaserScan',
    'sensor_msgs/RadarDetectionArray',
    'sensor_msgs/Temperature',
    'sensor_msgs/FluidPressure',
    'sensor_msgs/RelativeHumidity',
    'sensor_msgs/AirQuality',
    'sensor_msgs/WindSpeed',
    'sensor_msgs/WindDirection',
    'sensor_msgs/Illuminance',
    'nav_msgs/Path',
    'geometry_msgs/PoseArray',
    'nav_msgs/OccupancyGrid',
    'map_msgs/OccupancyGridUpdate',
    'trajectory_msgs/JointTrajectory'
];


const devices = [
    'jetson',
    'npc',
    'lpc',
    'opc'
];

const extendedFaker = faker as ExtendedFaker;

// define modifications
extendedFaker.ros = {
    topic: () => faker.helpers.arrayElement(ros_topic_names),
    topicType: () => faker.helpers.arrayElement(ros_topic_types),
    fileType: () => faker.helpers.arrayElement([FileType.BAG, FileType.MCAP]),
    fileName: (type: FileType) => `${faker.date.past().getTime()}_${faker.helpers.arrayElement(devices)}.${type.toLowerCase()}`
};

extendedFaker.mission = {
    name: () => {
        const events = [
            'Tunnel Mai',
            'Sechselläuten',
            'Expedition',
            'Voyage',
            'Exploration',
            'Survey',
            'Mission',
            'Quest',
            'Operation',
            'Journey'
        ];

        const date = faker.date.future().getDate();
        const event = faker.helpers.arrayElement(events);

        return `${event} ${date}`;
    }
};

extendedFaker.project = {
    name: () => {
        const prefixes = [
            'Digi',
            'Grand',
            'Heap',
            'ANYmal on ',
            'Robo',
            'Cyber',
            'Nano',
            'Quantum',
            'Future',
            'Synth',
            'Mech',
            'Exo'
        ];

        const suffixes = [
            'Forest',
            'Tour',
            'Wheels',
            'Bot',
            'Droid',
            'Ops',
            'Tech',
            'Lab',
            'Space',
            'Net',
            'Sys',
            'Link'
        ];

        const prefix = faker.helpers.arrayElement(prefixes);
        const suffix = faker.helpers.arrayElement(suffixes);

        // Combine prefix and suffix to create a project name
        return `${prefix}${suffix}`;
    }
}

export {extendedFaker};
