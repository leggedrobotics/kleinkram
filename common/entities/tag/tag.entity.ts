import { Column, Entity, ManyToOne } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Mission from '../mission/mission.entity';
import TagType from '../tagType/tagType.entity';
import User from '../user/user.entity';
import { TagDto } from '../../api/types/tags/TagsDto.dto';

@Entity()
export default class Tag extends BaseEntity {
    @Column({ nullable: true })
    STRING?: string;

    @Column({ nullable: true, type: 'double precision' })
    NUMBER?: number;

    @Column({ nullable: true })
    BOOLEAN?: boolean;

    @Column({ nullable: true })
    DATE?: Date;

    @Column({ nullable: true })
    LOCATION?: string;

    @ManyToOne(() => Mission, (mission) => mission.tags, {
        onDelete: 'CASCADE',
    })
    mission?: Mission;

    @ManyToOne(() => TagType, (tagType) => tagType.tags, { eager: true })
    tagType?: TagType;

    @ManyToOne(() => User, (user) => user.tags)
    creator?: User;

    get tagDto(): TagDto {
        if (!this.tagType) {
            throw new Error('TagType is not set');
        }

        return {
            get valueAsString(): string {
                return this.value.toString();
            },
            type: this.tagType.tagTypeDto,
            value:
                this.STRING ??
                this.NUMBER ??
                this.BOOLEAN ??
                this.DATE ??
                this.LOCATION ??
                '',
            createdAt: this.createdAt,
            datatype: this.tagType.datatype,
            name: this.tagType.name,
            updatedAt: this.updatedAt,
            uuid: this.uuid,
        };
    }
}
