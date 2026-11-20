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
import { getMetadataValueError } from '@kleinkram/validation';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { MetadataValueColumns, parseMetadataValue } from './metadata-values';

/**
 * The value columns for a client value, or 422 with what the value should
 * look like.
 */
const parseOrReject = (
    name: string,
    datatype: DataType,
    value: unknown,
): Partial<MetadataValueColumns> => {
    const parsed = parseMetadataValue(name, datatype, value);
    if (!parsed.ok) throw new UnprocessableEntityException(parsed.error);
    return parsed.columns;
};

/** One invalid metadata value in a 422 response */
interface MetadataValueError {
    /** uuid of the metadata type */
    field: string;
    name: string;
    error: string;
}

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

        const metadata = this.metadataRepository.create({
            metadataType,
            mission,
            ...parseOrReject(metadataType.name, metadataType.datatype, value),
        });
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

        Object.assign(
            existingMetadata,
            parseOrReject(metadataType.name, metadataType.datatype, value),
        );
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
    /**
     * Rejects the request if any value doesn't fit its metadata type, e.g.
     * `abc` for a NUMBER, `13.05.2024` for a DATE or a `javascript:` LINK.
     * Call it before writing anything, so a bad value cannot leave a
     * half-created mission or a partially replaced metadata set behind.
     * Every invalid value is reported, not just the first one:
     *
     *     422 { message: 'Metadata "…" must be …; …', errors: [{ field, name, error }] }
     *
     * `field` is the metadata type uuid and `error` a short line for the
     * field.
     */
    async validateValues(metadata: Record<string, unknown>): Promise<void> {
        // PostgreSQL matches uuids case-insensitively but returns them in
        // lowercase, so look the values up by their lowercase key.
        const valuesByUUID = new Map(
            Object.entries(metadata).map(([uuid, value]) => [
                uuid.toLowerCase(),
                value,
            ]),
        );
        if (valuesByUUID.size === 0) return;
        const metadataTypes = await this.metadataTypeRepository.find({
            where: { uuid: In([...valuesByUUID.keys()]) },
            select: { uuid: true, name: true, datatype: true },
        });

        const errors: MetadataValueError[] = [];
        const messages: string[] = [];
        for (const { uuid, name, datatype } of metadataTypes) {
            const value = valuesByUUID.get(uuid.toLowerCase());
            const parsed = parseMetadataValue(name, datatype, value);
            if (parsed.ok) continue;
            messages.push(parsed.error);
            errors.push({
                field: uuid,
                name,
                error: getMetadataValueError(datatype, value) ?? parsed.error,
            });
        }
        if (errors.length === 0) return;

        throw new UnprocessableEntityException({
            message: messages.join('; '),
            errors,
        });
    }

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

        // Reject invalid values before anything is written, so a bad value
        // does not leave the mission with a partially replaced metadata set.
        await this.validateValues(Object.fromEntries(metadataToUpsert));

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
