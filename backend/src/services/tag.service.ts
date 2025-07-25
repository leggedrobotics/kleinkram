import { AddTagDto, AddTagsDto } from '@common/api/types/tags/add-tags.dto';
import { DeleteTagDto } from '@common/api/types/tags/delete-tag.dto';
import { TagTypeDto, TagTypesDto } from '@common/api/types/tags/tags.dto';
import Mission from '@common/entities/mission/mission.entity';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import { DataType } from '@common/frontend_shared/enum';
import {
    ConflictException,
    Injectable,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

@Injectable()
export class TagService {
    constructor(
        @InjectRepository(Tag)
        private tagRepository: Repository<Tag>,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
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
            relations: ['tags', 'tags.tagType'],
        });

        if (mission.tags === undefined)
            throw new Error('Mission tags are undefined');

        const exisitingTagType = mission.tags.map((tag) => tag.tagType?.uuid);
        if (exisitingTagType.includes(tagType.uuid)) {
            throw new ConflictException('Tag already exists');
        }

        let tag: Tag | undefined;
        const isString = typeof value === 'string';
        switch (tagType.datatype) {
            case DataType.NUMBER: {
                if (typeof value === 'number' || isString) {
                    if (isString) {
                        value = Number.parseInt(value as string);
                    }
                    tag = this.tagRepository.create({
                        tagType,
                        [tagType.datatype]: value as number,
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
                    [DataType.STRING]: value,
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
                    [tagType.datatype]: value,
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
                        [tagType.datatype]: value as boolean,
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
                    [tagType.datatype]: new Date(value),
                    mission,
                });
                break;
            }

            default: {
                throw new Error('Unknown datatype');
            }
        }

        await this.tagRepository.save(tag);
        return {};
    }

    async updateTagType(
        missionUUID: string,
        tagTypeUUID: string,
        value: string | number | boolean,
    ): Promise<Tag> {
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        const exsitingTag = await this.tagRepository.findOne({
            where: {
                tagType: { uuid: tagTypeUUID },
                mission: { uuid: missionUUID },
            },
            relations: ['tagType', 'mission'],
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
                    exsitingTag[tagType.datatype] = value as number;
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
                exsitingTag[DataType.STRING] = value;
                break;
            }

            case DataType.LOCATION: {
                if (typeof value !== 'string') {
                    throw new UnprocessableEntityException(
                        'Value must be a string',
                    );
                }
                exsitingTag[tagType.datatype] = value;
                break;
            }

            case DataType.BOOLEAN: {
                if (typeof value === 'boolean' || isString) {
                    if (isString) {
                        value = value === 'true';
                    }
                    exsitingTag[tagType.datatype] = value as boolean;
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
                exsitingTag[tagType.datatype] = new Date(value);
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
        return Promise.all(
            Object.entries(tags).map(([tagTypeUUID, value]) =>
                this.addTagType(missionUUID, tagTypeUUID, value),
            ),
        );
    }

    async deleteTag(uuid: string): Promise<DeleteTagDto> {
        await this.tagRepository.delete({ uuid });
        return {};
    }

    async getAll(skip: number, take: number): Promise<TagTypesDto> {
        const [tags, count] = await this.tagTypeRepository.findAndCount({
            skip,
            take,
        });

        return {
            data: tags.map(
                (tag: TagType): TagTypeDto => ({
                    uuid: tag.uuid,
                    updatedAt: tag.updatedAt,
                    createdAt: tag.createdAt,
                    name: tag.name,
                    datatype: tag.datatype,
                    description: '',
                }),
            ),
            count,
            take,
            skip,
        };
    }

    async getFiltered(
        name: string,
        type: DataType | undefined,
        skip: number,
        take: number,
    ): Promise<TagTypesDto> {
        const where: FindOptionsWhere<TagType> = {};
        if (name !== '') {
            where.name = ILike(`%${name}%`);
        }
        if (type !== undefined && type !== DataType.ANY) {
            where.datatype = type;
        }
        const [tags, count] = await this.tagTypeRepository.findAndCount({
            where,
            skip,
            take,
        });

        return {
            data: tags.map(
                (tag: TagType): TagTypeDto => ({
                    uuid: tag.uuid,
                    updatedAt: tag.updatedAt,
                    createdAt: tag.createdAt,
                    name: tag.name,
                    datatype: tag.datatype,
                    description: '',
                }),
            ),
            count,
            take,
            skip,
        };
    }
}
