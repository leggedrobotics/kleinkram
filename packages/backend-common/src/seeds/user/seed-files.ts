/* eslint-disable complexity */
import { CategoryEntity } from '@backend-common/entities/category/category.entity';
import { FileEventEntity } from '@backend-common/entities/file/file-event.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { TopicEntity } from '@backend-common/entities/topic/topic.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileContext } from '@backend-common/factories/file/file.factory';
import { MetadataContext } from '@backend-common/factories/metadata/metadata.factory';
import { extendedFaker } from '@backend-common/faker-extended';
import {
    DataType,
    FileEventType,
    FileOrigin,
    FileType,
} from '@kleinkram/shared';
import * as Minio from 'minio';
import { execSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

import path from 'node:path';
import { Connection } from 'typeorm';
import { Factory } from 'typeorm-seeding';

/**
 * Seed metadata value based on tag type
 *
 * @param tagType
 * @param metadataProperties
 */
function seedMetadataValue(
    tagType: TagTypeEntity,
    metadataProperties: Partial<MetadataContext>,
) {
    switch (tagType.datatype) {
        case DataType.BOOLEAN: {
            metadataProperties.valueBoolean = extendedFaker.datatype.boolean();
            break;
        }
        case DataType.NUMBER: {
            metadataProperties.valueNumber = extendedFaker.number.int();
            break;
        }
        case DataType.DATE: {
            metadataProperties.valueDate = extendedFaker.date.past();
            break;
        }
        case DataType.LOCATION: {
            metadataProperties.valueLocation = `${String(extendedFaker.location.latitude())}, ${String(extendedFaker.location.longitude())}`;
            break;
        }
        case DataType.LINK: {
            metadataProperties.valueString = extendedFaker.internet.url();
            break;
        }
        default: {
            // STRING
            switch (tagType.name) {
                case 'coordinates': {
                    metadataProperties.valueString = `${String(extendedFaker.location.latitude())}, ${String(extendedFaker.location.longitude())}`;

                    break;
                }
                case 'location': {
                    metadataProperties.valueString =
                        extendedFaker.location.city();

                    break;
                }
                case 'robot_name': {
                    metadataProperties.valueString =
                        extendedFaker.animal.type();

                    break;
                }
                default: {
                    metadataProperties.valueString = tagType.name.includes(
                        'description',
                    )
                        ? extendedFaker.lorem.sentence()
                        : extendedFaker.lorem.words(3);
                }
            }
        }
    }
}

export const seedFiles = async (
    factory: Factory,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    conn: Connection,
    adminUser: UserEntity,
    createdMissions: MissionEntity[],
    tagTypes: TagTypeEntity[],
): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log('4. Generate and Upload Data...');
    const generateScriptPath = '/app/cli/tests/generate_test_data.py';
    try {
        execSync(`python3 ${generateScriptPath}`);
    } catch (error) {
        console.error('Failed to generate test data', error);
    }

    // Minio Client Setup
    const minioClient = new Minio.Client({
        endPoint:
            process.env.MINIO_ENDPOINT_INTERNAL ??
            process.env.MINIO_ENDPOINT ??
            'minio',
        port: 9000,
        useSSL: false,
        accessKey: process.env.MINIO_ACCESS_KEY ?? '',
        secretKey: process.env.MINIO_SECRET_KEY ?? '',
    });

    const bucketName = process.env.MINIO_DATA_BUCKET_NAME ?? 'data';
    const dataDirectory = '/app/cli/tests/data';

    if (fs.existsSync(dataDirectory)) {
        const files = fs.readdirSync(dataDirectory);
        let missionIndex = 0;

        // Mapping for meaningful filenames

        const meaningfulNames: Record<string, string[]> = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '10_KB.bag': ['highway_drive_01.bag', 'urban_nav_test_01.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '50_KB.bag': ['pick_place_demo.bag', 'assembly_run_01.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '1_MB.bag': ['perimeter_scan_01.bag', 'rescue_mission_alpha.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '17_MB.bag': ['highway_long_drive.bag', 'urban_heavy_traffic.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            '125_MB.bag': ['full_system_test.bag', 'endurance_run.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'frontend_test.bag': ['frontend_viewer_test.bag'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'test.mcap': ['test_data.mcap'],
            // eslint-disable-next-line @typescript-eslint/naming-convention
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
            const fileBuffer = fs.readFileSync(filePath);
            const fileHash = crypto
                .createHash('md5')
                .update(fileBuffer)
                .digest('base64');

            // We will create multiple files from one source file to distribute them
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const targetNames = meaningfulNames[fileName] || [fileName];

            for (const targetName of targetNames) {
                if (createdMissions.length === 0) break;

                const mission =
                    createdMissions[missionIndex % createdMissions.length];
                missionIndex++;

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            name: randomCategoryName ?? '',
                            project: { uuid: mission.project.uuid },
                        },
                        relations: ['project'],
                    });
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                if (!category) {
                    category = await factory(CategoryEntity)({
                        name: randomCategoryName,
                        project: mission.project,
                        creator: adminUser,
                    }).create();
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
                    hash: fileHash,
                    categories: [category],
                } as FileContext).create();

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
                        }).create({
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
                    }).create();
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
                }).create();

                // Create Metadata for Mission (if not exists)
                // Iterate over all available tag types to ensure coverage
                for (const tagType of tagTypes) {
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
                        const metadataProperties = {
                            mission: mission,
                            tagType: tagType,
                            creator: adminUser,
                        } as Partial<MetadataContext>;

                        seedMetadataValue(tagType, metadataProperties);

                        await factory(MetadataEntity)(
                            metadataProperties,
                        ).create();
                    }
                }

                const objectName = fileEntity.uuid;

                // eslint-disable-next-line no-console
                console.log(
                    `[INFO] Mapping: ${fileName} -> ${targetName} (DB ID: ${fileEntity.uuid})`,
                );

                try {
                    await minioClient.fPutObject(
                        bucketName,
                        objectName,
                        filePath,
                        {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            'Content-Type': 'application/octet-stream',
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            'X-Amz-Meta-Original-Filename': targetName,
                        },
                    );
                    // eslint-disable-next-line no-console
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
