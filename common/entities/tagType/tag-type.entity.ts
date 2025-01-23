import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import { DataType } from '../../frontend_shared/enum';
import Project from '../project/project.entity';
import Tag from '../tag/tag.entity';
import { TagTypeDto } from '../../api/types/tags/tags.dto';

@Entity()
export default class TagType extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    datatype!: DataType;

    @ManyToMany(() => Project, (project) => project.requiredTags)
    @JoinTable()
    project?: Project;

    @OneToMany(() => Tag, (tag) => tag.tagType)
    tags?: Tag[];

    get tagTypeDto(): TagTypeDto {
        return {
            uuid: this.uuid,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            name: this.name,
            description: this.description ?? '',
            datatype: this.datatype,
        };
    }
}


export const tagTypeEntityToDto = (tagType: TagType): TagTypeDto => {
    return {
        uuid: tagType.uuid,
        createdAt: tagType.createdAt,
        updatedAt: tagType.updatedAt,
        name: tagType.name,
        description: tagType.description ?? '',
        datatype: tagType.datatype,
    };
}
