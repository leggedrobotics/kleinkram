import * as Minio from 'minio';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import path from 'node:path';
import { Connection } from 'typeorm';
import { Factory } from 'typeorm-seeding';
import CategoryEntity from '../../entities/category/category.entity';
import FileEventEntity from '../../entities/file/file-event.entity';
import FileEntity from '../../entities/file/file.entity';
import MetadataEntity from '../../entities/metadata/metadata.entity';
import MissionEntity from '../../entities/mission/mission.entity';
import TagTypeEntity from '../../entities/tagType/tag-type.entity';
import TopicEntity from '../../entities/topic/topic.entity';
import UserEntity from '../../entities/user/user.entity';
import {
    FileEventType,
    FileOrigin,
    FileType,
} from '../../frontend_shared/enum';

export const seedFiles = async (
    factory: Factory,
    conn: Connection,
    adminUser: UserEntity,
    createdMissions: MissionEntity[],
    tagTypes: TagTypeEntity[],
): Promise<void> => {
    console.log('4. Generate and Upload Data...');
    const generateScriptPath = 'cli/tests/generate_test_data.py';
    try {
        execSync(`python3 ${generateScriptPath}`);
    } catch (error) {
        console.error('Failed to generate test data', error);
    }

    // Minio Client Setup
    const minioClient = new Minio.Client({
        endPoint:
            process.env['MINIO_ENDPOINT_INTERNAL'] ||
            process.env['MINIO_ENDPOINT'] ||
            'minio',
        port: 9000,
        useSSL: false,
        accessKey: process.env['MINIO_ACCESS_KEY'] ?? '',
        secretKey: process.env['MINIO_SECRET_KEY'] ?? '',
    });

    const bucketName = process.env['MINIO_DATA_BUCKET_NAME'] || 'data';
    const dataDirectory = 'cli/tests/data';

    if (fs.existsSync(dataDirectory)) {
        const files = fs.readdirSync(dataDirectory);
        let missionIndex = 0;

        // Mapping for meaningful filenames
        const meaningfulNames: Record<string, string[]> = {
            '10_KB.bag': ['highway_drive_01.bag', 'urban_nav_test_01.bag'],
            '50_KB.bag': ['pick_place_demo.bag', 'assembly_run_01.bag'],
            '1_MB.bag': ['perimeter_scan_01.bag', 'rescue_mission_alpha.bag'],
            '17_MB.bag': ['highway_long_drive.bag', 'urban_heavy_traffic.bag'],
            '125_MB.bag': ['full_system_test.bag', 'endurance_run.bag'],
            'frontend_test.bag': ['frontend_viewer_test.bag'],
            'test.mcap': ['test_data.mcap'],
            'test.yaml': ['config_test.yaml'],
        };

        // Common categories
        const categoryNames = [
            'Test Data',
            'Simulation',
            'Real World',
            'Calibration',
        ];

        for (const fileName of files) {
            // Include .bag, .mcap, .yaml
            if (
                !fileName.endsWith('.bag') &&
                !fileName.endsWith('.mcap') &&
                !fileName.endsWith('.yaml')
            )
                continue;

            const filePath = path.join(dataDirectory, fileName);
            const fileSize = fs.statSync(filePath).size;

            // We will create multiple files from one source file to distribute them
            const targetNames = meaningfulNames[fileName] || [fileName];

            for (const targetName of targetNames) {
                if (createdMissions.length === 0) break;

                const mission =
                    createdMissions[missionIndex % createdMissions.length];
                missionIndex++;

                if (!mission?.project) continue;

                // Create Category for this project if not exists
                const randomCategoryName =
                    categoryNames[
                        Math.floor(Math.random() * categoryNames.length)
                    ];
                let category = await conn
                    .getRepository(CategoryEntity)
                    .findOne({
                        where: {
                            name: randomCategoryName ?? '',
                            project: { uuid: mission.project.uuid },
                        },
                        relations: ['project'],
                    });
                if (!category) {
                    category = await factory(CategoryEntity)({
                        name: randomCategoryName,
                        project: mission.project,
                        creator: adminUser,
                    } as any).create();
                }

                let fileType = FileType.BAG;
                if (targetName.endsWith('.mcap')) fileType = FileType.MCAP;
                else if (targetName.endsWith('.yaml')) fileType = FileType.YAML;

                const fileEntity = await factory(FileEntity)({
                    mission: mission,
                    user: adminUser,
                    filename: targetName,
                    size: fileSize,
                    type: fileType,
                    origin: FileOrigin.UPLOAD,
                    categories: [category],
                } as any).create();

                if (!fileEntity.uuid) {
                    console.error(
                        'ERROR: File Entity was created but has no UUID!',
                    );
                    continue;
                }

                // Create Topics (only for bag files for now, maybe mcap later if we parse it)
                if (fileType === FileType.BAG) {
                    let topics = [
                        {
                            name: '/test_topic',
                            type: 'std_msgs/msg/String',
                            frequency: 1,
                        },
                    ];

                    if (targetName === 'frontend_viewer_test.bag') {
                        topics = [
                            {
                                name: '/rosout',
                                type: 'rosgraph_msgs/msg/Log',
                                frequency: 10,
                            },
                            {
                                name: '/sensors/temperature',
                                type: 'sensor_msgs/msg/Temperature',
                                frequency: 10,
                            },
                            {
                                name: '/time_ref',
                                type: 'sensor_msgs/msg/TimeReference',
                                frequency: 10,
                            },
                            {
                                name: '/cmd_vel',
                                type: 'geometry_msgs/msg/TwistStamped',
                                frequency: 10,
                            },
                            {
                                name: '/tf',
                                type: 'tf2_msgs/msg/TFMessage',
                                frequency: 10,
                            },
                        ];
                    }

                    for (const topicDefinition of topics) {
                        await factory(TopicEntity)({
                            file: fileEntity,
                        } as any).create({
                            name: topicDefinition.name,
                            type: topicDefinition.type,
                            frequency: topicDefinition.frequency,
                            nrMessages: BigInt(1000),
                            messageEncoding: 'cdr',
                        });
                    }

                    // Create File Event (Topics Extracted)
                    await factory(FileEventEntity)({
                        file: fileEntity,
                        mission: mission,
                        actor: adminUser,
                        type: FileEventType.TOPICS_EXTRACTED,
                        details: {
                            topicCount: topics.length,
                            method: 'seeded',
                            extractedAt: new Date(),
                            durationMs: 100,
                        },
                    } as any).create();
                }

                // Create File Event (Upload Completed)
                await factory(FileEventEntity)({
                    file: fileEntity,
                    mission: mission,
                    actor: adminUser,
                    type: FileEventType.UPLOAD_COMPLETED,
                    details: {
                        origin: FileOrigin.UPLOAD,
                        source: 'Seeding Script',
                    },
                } as any).create();

                // Create Metadata for Mission (if not exists)
                // We'll just add a random metadata to the mission
                const tagType = tagTypes[0]; // Just pick the first one
                if (tagType) {
                    // Check if mission already has this tag
                    const existingTag = await conn
                        .getRepository(MetadataEntity)
                        .findOne({
                            where: {
                                mission: { uuid: mission.uuid },
                                tagType: { uuid: tagType.uuid },
                            },
                        });
                    if (!existingTag) {
                        await factory(MetadataEntity)({
                            mission: mission,
                            tagType: tagType,
                            creator: adminUser,
                            value_string: 'Seeded Mission Data',
                        } as any).create();
                    }
                }

                const objectName = fileEntity.uuid;
                console.log(
                    `[INFO] Mapping: ${fileName} -> ${targetName} (DB ID: ${fileEntity.uuid})`,
                );

                try {
                    await minioClient.fPutObject(
                        bucketName,
                        objectName,
                        filePath,
                        {
                            'Content-Type': 'application/octet-stream',
                            'X-Amz-Meta-Original-Filename': targetName,
                        },
                    );
                    console.log(
                        `[SUCCESS] File available at: ${bucketName}/${objectName}`,
                    );
                } catch (error) {
                    console.error(
                        `Failed to upload ${fileName} to MinIO!`,
                        error,
                    );
                }
            }
        }
    }
};
