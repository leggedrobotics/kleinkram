import {
    ConflictException,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
import { DataType } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';

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
        value: string,
    ): Promise<Tag> {
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
        });

        let tag: Tag | undefined;
        switch (tagType.datatype) {
            case DataType.STRING:
            case DataType.NUMBER:
            case DataType.LOCATION:
                tag = this.tagRepository.create({
                    datatype: tagType.datatype,
                    [tagType.datatype]: value,
                    name: tagType.name,
                    mission,
                });
                break;
            case DataType.BOOLEAN:
                tag = this.tagRepository.create({
                    datatype: tagType.datatype,
                    [tagType.datatype]: !!value,
                    name: tagType.name,
                    mission,
                });
                break;
            case DataType.DATE:
                tag = this.tagRepository.create({
                    datatype: tagType.datatype,
                    [tagType.datatype]: new Date(value),
                    name: tagType.name,
                    mission,
                });
                break;

            default:
                throw new Error('Unknown datatype');
        }

        return this.tagRepository.save(tag);
    }

    async deleteTag(uuid: string): Promise<void> {
        await this.tagRepository.delete({ uuid });
    }

    async getAll(): Promise<TagType[]> {
        return this.tagTypeRepository.find();
    }
}
