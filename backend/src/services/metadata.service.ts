import {
    AddTagDto,
    AddTagsDto,
    DeleteTagDto,
    TagTypeDto,
    TagTypesDto,
} from '@kleinkram/api-dto';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { DataType } from '@kleinkram/shared';
import {
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
        private tagRepository: Repository<MetadataEntity>,
        @InjectRepository(TagTypeEntity)
        private tagTypeRepository: Repository<TagTypeEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
    ) {}

    async create(name: string, type: DataType): Promise<TagTypeDto> {
        const existingTagType = await this.tagTypeRepository.findOne({
            where: { name, datatype: type },
        });
        if (existingTagType) {
            throw new ConflictException('TagType already exists');
        }
        const tagType = this.tagTypeRepository.create({
            name,
            datatype: type,
        });

        const databaseTag = await this.tagTypeRepository.save(tagType);

        return {
            uuid: databaseTag.uuid,
            updatedAt: databaseTag.updatedAt,
            createdAt: databaseTag.createdAt,
            name: databaseTag.name,
            datatype: databaseTag.datatype,
            description: '',
        };
    }

    async addTagType(
        missionUUID: string,
        tagTypeUUID: string,
        value: string | number | boolean,
    ): Promise<AddTagDto> {
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: {
                tags: {
                    tagType: true,
                },
            },
        });

        if (mission.tags === undefined)
            throw new Error('Mission tags are undefined');

        const exisitingTagType = mission.tags.map((tag) => tag.tagType?.uuid);
        if (exisitingTagType.includes(tagType.uuid)) {
            throw new ConflictException('Tag already exists');
        }

        let tag: MetadataEntity | undefined;
        const isString = typeof value === 'string';
        switch (tagType.datatype) {
            case DataType.NUMBER: {
                if (typeof value === 'number' || isString) {
                    if (isString) {
                        value = Number.parseInt(value as string);
                    }
                    tag = this.tagRepository.create({
                        tagType,

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
                tag = this.tagRepository.create({
                    tagType,
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

                tag = this.tagRepository.create({
                    tagType,
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
                    tag = this.tagRepository.create({
                        tagType,
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
                tag = this.tagRepository.create({
                    tagType,
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

        await this.tagRepository.save(tag);
        return { success: true };
    }

    async updateTagType(
        missionUUID: string,
        tagTypeUUID: string,
        value: string | number | boolean,
    ): Promise<MetadataEntity> {
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        const exsitingTag = await this.tagRepository.findOne({
            where: {
                tagType: { uuid: tagTypeUUID },
                mission: { uuid: missionUUID },
            },
            relations: {
                tagType: true,
                mission: true,
            },
        });

        if (!exsitingTag) {
            throw new ConflictException("Tag hasn't been set yet");
        }

        const isString = typeof value === 'string';
        switch (tagType.datatype) {
            case DataType.NUMBER: {
                if (typeof value === 'number' || isString) {
                    if (isString) {
                        value = Number.parseInt(value as string);
                    }

                    exsitingTag.value_number = value as number;
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

                exsitingTag.value_string = value;
                break;
            }

            case DataType.BOOLEAN: {
                if (typeof value === 'boolean' || isString) {
                    if (isString) {
                        value = value === 'true';
                    }

                    exsitingTag.value_boolean = value as boolean;
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

                exsitingTag.value_date = new Date(value);
                break;
            }
            case DataType.LOCATION: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }

                exsitingTag.value_location = value;
                break;
            }

            default: {
                throw new Error('Unknown datatype');
            }
        }
        return this.tagRepository.save(exsitingTag);
    }

    async addTags(
        missionUUID: string,
        tags: Record<string, string>,
    ): Promise<AddTagsDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: {
                tags: {
                    tagType: true,
                },
            },
        });

        if (mission.tags === undefined) {
            throw new Error('Mission tags are undefined');
        }

        // Filter out empty values and identify tags to keep/upsert
        const tagsToUpsert = Object.entries(tags).filter(([_, value]) => {
            const valueToCheck = value as unknown;
            return (
                valueToCheck !== '' &&
                valueToCheck !== null &&
                valueToCheck !== undefined
            );
        });
        const tagTypeUUIDsToKeep = new Set(tagsToUpsert.map(([uuid]) => uuid));

        // Delete any existing tags that are not in the list of tags to keep
        const tagsToDelete = mission.tags.filter(
            (tag) => !tagTypeUUIDsToKeep.has(tag.tagType?.uuid ?? ''),
        );
        if (tagsToDelete.length > 0) {
            await this.tagRepository.remove(tagsToDelete);
        }

        await Promise.all(
            tagsToUpsert.map(async ([tagTypeUUID, value]) => {
                const tag = mission.tags?.find(
                    (_tag) => _tag.tagType?.uuid === tagTypeUUID,
                );
                if (tag) {
                    return this.updateTagType(missionUUID, tagTypeUUID, value);
                }
                return this.addTagType(missionUUID, tagTypeUUID, value);
            }),
        );
        return { success: true };
    }

    async deleteTag(uuid: string): Promise<DeleteTagDto> {
        await this.tagRepository.delete({ uuid });
        return { success: true };
    }

    async getAll(skip: number, take: number): Promise<TagTypesDto> {
        const [tags, count] = await this.tagTypeRepository.findAndCount({
            skip,
            take,
        });

        return {
            data: tags.map((tag: TagTypeEntity): TagTypeDto => ({
                uuid: tag.uuid,
                updatedAt: tag.updatedAt,
                createdAt: tag.createdAt,
                name: tag.name,
                datatype: tag.datatype,
                description: '',
            })),
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
    ): Promise<TagTypesDto> {
        const where: FindOptionsWhere<TagTypeEntity> = {};
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
        const [tags, count] = await this.tagTypeRepository.findAndCount({
            where,
            skip,
            take,
        });

        return {
            data: tags.map((tag: TagTypeEntity): TagTypeDto => ({
                uuid: tag.uuid,
                updatedAt: tag.updatedAt,
                createdAt: tag.createdAt,
                name: tag.name,
                datatype: tag.datatype,
                description: '',
            })),
            count,
            take,
            skip,
        };
    }
}
