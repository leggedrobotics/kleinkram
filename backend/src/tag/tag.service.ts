import {
    ConflictException,
    ForbiddenException,
    Injectable,
    UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
import { DataType } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';
import * as assert from 'node:assert';

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

    async create(name: string, type: DataType): Promise<TagType> {
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
        return this.tagTypeRepository.save(tagType);
    }

    async addTagType(
        missionUUID: string,
        tagTypeUUID: string,
        value: string | number | boolean,
    ): Promise<Tag> {
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['tags', 'tags.tagType'],
        });
        const exisitingTagType = mission.tags.map((tag) => tag.tagType.uuid);
        if (exisitingTagType.includes(tagType.uuid)) {
            throw new ConflictException('Tag already exists');
        }

        let tag: Tag | undefined;
        const isString = typeof value === 'string';
        switch (tagType.datatype) {
            case DataType.NUMBER:
                if (typeof value == 'number' || isString) {
                    if (isString) {
                        value = parseInt(value as string);
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
            case DataType.STRING:
            case DataType.LOCATION:
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
            case DataType.BOOLEAN:
                if (typeof value == 'boolean' || isString) {
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
                    'Value must be a number',
                );
            case DataType.DATE:
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

            default:
                throw new Error('Unknown datatype');
        }

        return this.tagRepository.save(tag);
    }
    async addTags(
        missionUUID: string,
        tags: Record<string, string>,
    ): Promise<Tag[]> {
        return Promise.all(
            Object.entries(tags).map(([tagTypeUUID, value]) =>
                this.addTagType(missionUUID, tagTypeUUID, value),
            ),
        );
    }
    async deleteTag(uuid: string): Promise<void> {
        await this.tagRepository.delete({ uuid });
    }

    async getAll(): Promise<TagType[]> {
        return this.tagTypeRepository.find();
    }
}
