import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { MetadataTypeEntity } from '@backend-common/entities/metadata/metadata-type.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToOne } from 'typeorm';

@Entity({ name: 'metadata' })
export class MetadataEntity extends BaseEntity {
    @Column({ nullable: true, name: 'STRING' })

    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_string?: string;

    @Column({ nullable: true, type: 'double precision', name: 'NUMBER' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_number?: number;

    @Column({ nullable: true, name: 'BOOLEAN' })

    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_boolean?: boolean;

    @Column({ nullable: true, name: 'DATE' })

    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_date?: Date;

    @Column({ nullable: true, name: 'LOCATION' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    value_location?: string;

    @ManyToOne(
        () => MissionEntity,
        (mission: MissionEntity) => mission.metadata,
        {
            onDelete: 'CASCADE',
        },
    )
    mission?: MissionEntity;

    @ManyToOne(
        () => MetadataTypeEntity,
        (metadataType: MetadataTypeEntity) => metadataType.metadata,
        { eager: true },
    )
    metadataType?: MetadataTypeEntity;

    @ManyToOne(() => UserEntity, (user: UserEntity) => user.metadata, {
        onDelete: 'SET NULL',
        nullable: true,
    })
    creator?: UserEntity;
}
