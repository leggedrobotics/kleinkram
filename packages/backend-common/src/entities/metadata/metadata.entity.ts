import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

// TODO: rename the SQL table from tag to metadata
//   in some early version of kleinkram metadata were named
//   tags, this is a legacy and should be cleaned up at some point
@Entity({ name: 'tag' })
export class MetadataEntity extends BaseEntity {
    @Column({ nullable: true, name: 'STRING' })
    value_string?: string;

    @Column({ nullable: true, type: 'double precision', name: 'NUMBER' })
    value_number?: number;

    @Column({ nullable: true, name: 'BOOLEAN' })
    value_boolean?: boolean;

    @Column({ nullable: true, name: 'DATE' })
    value_date?: Date;

    @Column({ nullable: true, name: 'LOCATION' })
    value_location?: string;

    @ManyToOne(() => MissionEntity, (mission) => mission.tags, {
        onDelete: 'CASCADE',
    })
    mission?: MissionEntity;

    @ManyToOne(() => TagTypeEntity, (tagType) => tagType.tags, { eager: true })
    tagType?: TagTypeEntity;

    @ManyToOne(() => UserEntity, (user) => user.tags, {
        onDelete: 'SET NULL',
        nullable: true,
    })
    creator?: UserEntity;
}
