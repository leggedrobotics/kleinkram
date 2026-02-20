import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { ApiKeyEntity } from '@backend-common/entities/auth/api-key.entity';
import { MissionAccessEntity } from '@backend-common/entities/auth/mission-access.entity';
import { BaseEntity } from '@backend-common/entities/base-entity.entity';
import { FileEntity } from '@backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@backend-common/entities/file/ingestion-job.entity';
import { MetadataEntity } from '@backend-common/entities/metadata/metadata.entity';
import { ProjectEntity } from '@backend-common/entities/project/project.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';

@Index('unique_mission_name_per_project', ['name', 'project'], {
    where: '"deletedAt" IS NULL',
    unique: true,
})
@Entity({ name: 'mission' })
export class MissionEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(
        () => ProjectEntity,
        (project: ProjectEntity) => project.missions,
        {
            nullable: false,
            onDelete: 'CASCADE',
        },
    )
    project?: ProjectEntity;

    @OneToMany(() => FileEntity, (file: FileEntity) => file.mission)
    files?: FileEntity[];

    @OneToMany(() => ActionEntity, (action: ActionEntity) => action.mission)
    actions?: ActionEntity[];

    @OneToMany(
        () => IngestionJobEntity,
        (queue: IngestionJobEntity) => queue.mission,
    )
    ingestionJobs?: IngestionJobEntity[];

    @ManyToOne(() => UserEntity, (user: UserEntity) => user.missions, {
        nullable: false,
    })
    creator?: UserEntity;

    @OneToMany(() => ApiKeyEntity, (apiKey: ApiKeyEntity) => apiKey.mission)

    // eslint-disable-next-line @typescript-eslint/naming-convention
    api_keys?: ApiKeyEntity[];

    @OneToMany(
        () => MissionAccessEntity,
        (missionAccess: MissionAccessEntity) => missionAccess.mission,
    )
    // eslint-disable-next-line @typescript-eslint/naming-convention
    mission_accesses?: MissionAccessEntity[];

    @OneToMany(() => MetadataEntity, (tag: MetadataEntity) => tag.mission)
    tags?: MetadataEntity[];

    fileCount?: number;
    size?: number;
}
