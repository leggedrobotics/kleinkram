import {
    DeleteMetadataDto,
    MetadataTypeDto,
    MetadataTypesDto,
    UpdateMissionMetadataDto,
} from '@kleinkram/api-dto';
import { MetadataTypeEntity } from '@kleinkram/backend-common/entities/metadata/metadata-type.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { DataType } from '@kleinkram/shared';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

@Injectable()
export class MetadataService {
    constructor(
        @InjectRepository(MetadataEntity)
        private metadataRepository: Repository<MetadataEntity>,
        @InjectRepository(MetadataTypeEntity)
        private metadataTypeRepository: Repository<MetadataTypeEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
    ) {}

    async createMetadataType(
        name: string,
        type: DataType,
    ): Promise<MetadataTypeDto> {
        const existingMetadataType = await this.metadataTypeRepository.findOne({
            where: { name, datatype: type },
        });
        if (existingMetadataType) {
            throw new ConflictException('Metadata type already exists');
        }
        const metadataType = this.metadataTypeRepository.create({
            name,
            datatype: type,
        });

        const databaseMetadataType =
            await this.metadataTypeRepository.save(metadataType);

        return {
            uuid: databaseMetadataType.uuid,
            updatedAt: databaseMetadataType.updatedAt,
            createdAt: databaseMetadataType.createdAt,
            name: databaseMetadataType.name,
            datatype: databaseMetadataType.datatype,
            description: '',
        };
    }

    async addMetadata(
        missionUUID: string,
        metadataTypeUUID: string,
        value: string | number | boolean,
    ): Promise<UpdateMissionMetadataDto> {
        const metadataType = await this.metadataTypeRepository.findOneOrFail({
            where: { uuid: metadataTypeUUID },
        });
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: {
                metadata: {
                    metadataType: true,
                },
            },
        });

        if (mission.metadata === undefined)
            throw new Error('Mission metadata is undefined');

        const existingMetadataTypeUUIDs = mission.metadata.map(
            (metadata) => metadata.metadataType?.uuid,
        );
        if (existingMetadataTypeUUIDs.includes(metadataType.uuid)) {
            throw new ConflictException('Metadata already exists');
        }

        let metadata: MetadataEntity | undefined;
        const isString = typeof value === 'string';
        switch (metadataType.datatype) {
            case DataType.NUMBER: {
                if (typeof value === 'number' || isString) {
                    if (isString) {
                        value = Number.parseInt(value as string);
                    }
                    metadata = this.metadataRepository.create({
                        metadataType,

                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        value_number: value as number,
                        mission,
                    });
                    break;
                }

                throw new UnprocessableEntityException(
                    'Value must be a number',
                );
            }
            case DataType.STRING:
            case DataType.LINK: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }
                metadata = this.metadataRepository.create({
                    metadataType,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    value_string: value,
                    mission,
                });
                break;
            }
            case DataType.LOCATION: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }

                metadata = this.metadataRepository.create({
                    metadataType,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    value_location: value,
                    mission,
                });
                break;
            }
            case DataType.BOOLEAN: {
                if (typeof value === 'boolean' || isString) {
                    if (isString) {
                        value = value === 'true';
                    }
                    metadata = this.metadataRepository.create({
                        metadataType,
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        value_boolean: value as boolean,
                        mission,
                    });
                    break;
                }

                throw new UnprocessableEntityException(
                    'Value must be a boolean',
                );
            }
            case DataType.DATE: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }
                metadata = this.metadataRepository.create({
                    metadataType,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    value_date: new Date(value),
                    mission,
                });
                break;
            }

            default: {
                throw new Error('Unknown datatype');
            }
        }

        await this.metadataRepository.save(metadata);
        return { success: true };
    }

    async updateMetadata(
        missionUUID: string,
        metadataTypeUUID: string,
        value: string | number | boolean,
    ): Promise<MetadataEntity> {
        const metadataType = await this.metadataTypeRepository.findOneOrFail({
            where: { uuid: metadataTypeUUID },
        });
        const existingMetadata = await this.metadataRepository.findOne({
            where: {
                metadataType: { uuid: metadataTypeUUID },
                mission: { uuid: missionUUID },
            },
            relations: {
                metadataType: true,
                mission: true,
            },
        });

        if (!existingMetadata) {
            throw new ConflictException("Metadata hasn't been set yet");
        }

        const isString = typeof value === 'string';
        switch (metadataType.datatype) {
            case DataType.NUMBER: {
                if (typeof value === 'number' || isString) {
                    if (isString) {
                        value = Number.parseInt(value as string);
                    }

                    existingMetadata.value_number = value as number;
                    break;
                }
                throw new UnprocessableEntityException(
                    'Value must be a number',
                );
            }

            case DataType.STRING:
            case DataType.LINK: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }

                existingMetadata.value_string = value;
                break;
            }

            case DataType.BOOLEAN: {
                if (typeof value === 'boolean' || isString) {
                    if (isString) {
                        value = value === 'true';
                    }

                    existingMetadata.value_boolean = value as boolean;
                    break;
                }

                throw new UnprocessableEntityException(
                    'Value must be a boolean',
                );
            }
            case DataType.DATE: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }

                existingMetadata.value_date = new Date(value);
                break;
            }
            case DataType.LOCATION: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }

                existingMetadata.value_location = value;
                break;
            }

            default: {
                throw new Error('Unknown datatype');
            }
        }
        return this.metadataRepository.save(existingMetadata);
    }

    /**
     * Replaces a mission's metadata with the given set.
     *
     * This is a *full replace*: any metadata whose metadata type is absent
     * from `metadata` (or is present with an empty value) is removed.
     * Metadata whose type is listed in the mission's project
     * `requiredMetadataTypes` cannot be removed this way — such a request is
     * rejected rather than silently dropping the required value.
     *
     * @param missionUUID the mission to update
     * @param metadata metadata type uuid to value; the complete new metadata
     *   set
     * @throws BadRequestException if the payload would remove metadata that
     *   the project marks as required
     */
    async replaceMissionMetadata(
        missionUUID: string,
        metadata: Record<string, string>,
    ): Promise<UpdateMissionMetadataDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: {
                metadata: {
                    metadataType: true,
                },
                project: {
                    requiredMetadataTypes: true,
                },
            },
        });

        if (mission.metadata === undefined) {
            throw new Error('Mission metadata is undefined');
        }

        // Filter out empty values and identify metadata to keep/upsert
        const metadataToUpsert = Object.entries(metadata).filter(
            ([_, value]) => {
                const valueToCheck = value as unknown;
                return (
                    valueToCheck !== '' &&
                    valueToCheck !== null &&
                    valueToCheck !== undefined
                );
            },
        );
        const metadataTypeUUIDsToKeep = new Set(
            metadataToUpsert.map(([uuid]) => uuid),
        );

        // Delete any existing metadata whose type is not in the list to keep
        const metadataToDelete = mission.metadata.filter(
            (existing) =>
                !metadataTypeUUIDsToKeep.has(existing.metadataType?.uuid ?? ''),
        );

        // A partial payload (e.g. from `klein mission update --metadata`) must
        // never strip metadata the project requires.
        const requiredMetadataTypeUUIDs = new Set(
            (mission.project?.requiredMetadataTypes ?? []).map(
                (metadataType) => metadataType.uuid,
            ),
        );
        const requiredMetadataToDelete = metadataToDelete.filter((existing) =>
            requiredMetadataTypeUUIDs.has(existing.metadataType?.uuid ?? ''),
        );
        if (requiredMetadataToDelete.length > 0) {
            const names = requiredMetadataToDelete
                .map(
                    (existing) =>
                        existing.metadataType?.name ??
                        existing.metadataType?.uuid ??
                        '?',
                )
                .join(', ');
            throw new BadRequestException(
                `Cannot remove required metadata: ${names}. ` +
                    'This endpoint replaces the full metadata set, so every ' +
                    'metadata type required by the project must be included ' +
                    'in the request.',
            );
        }

        if (metadataToDelete.length > 0) {
            await this.metadataRepository.remove(metadataToDelete);
        }

        await Promise.all(
            metadataToUpsert.map(async ([metadataTypeUUID, value]) => {
                const existing = mission.metadata?.find(
                    (_metadata) =>
                        _metadata.metadataType?.uuid === metadataTypeUUID,
                );
                if (existing) {
                    return this.updateMetadata(
                        missionUUID,
                        metadataTypeUUID,
                        value,
                    );
                }
                return this.addMetadata(missionUUID, metadataTypeUUID, value);
            }),
        );
        return { success: true };
    }

    async deleteMetadata(uuid: string): Promise<DeleteMetadataDto> {
        await this.metadataRepository.delete({ uuid });
        return { success: true };
    }

    async getAll(skip: number, take: number): Promise<MetadataTypesDto> {
        const [metadataTypes, count] =
            await this.metadataTypeRepository.findAndCount({
                skip,
                take,
            });

        return {
            data: metadataTypes.map(
                (metadataType: MetadataTypeEntity): MetadataTypeDto => ({
                    uuid: metadataType.uuid,
                    updatedAt: metadataType.updatedAt,
                    createdAt: metadataType.createdAt,
                    name: metadataType.name,
                    datatype: metadataType.datatype,
                    description: '',
                }),
            ),
            count,
            take,
            skip,
        };
    }

    async getFiltered(
        name: string | undefined,
        type: DataType | undefined,
        skip: number,
        take: number,
    ): Promise<MetadataTypesDto> {
        const where: FindOptionsWhere<MetadataTypeEntity> = {};
        if (name) {
            where.name = ILike(`%${name}%`);
        }
        if (
            type !== undefined &&
            type !== DataType.ANY &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (type as any) !== ''
        ) {
            where.datatype = type;
        }
        const [metadataTypes, count] =
            await this.metadataTypeRepository.findAndCount({
                where,
                skip,
                take,
            });

        return {
            data: metadataTypes.map(
                (metadataType: MetadataTypeEntity): MetadataTypeDto => ({
                    uuid: metadataType.uuid,
                    updatedAt: metadataType.updatedAt,
                    createdAt: metadataType.createdAt,
                    name: metadataType.name,
                    datatype: metadataType.datatype,
                    description: '',
                }),
            ),
            count,
            take,
            skip,
        };
    }
}
