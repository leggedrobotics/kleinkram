import ActionEntity from '@backend-common/entities/action/action.entity';
import ApikeyEntity from '@backend-common/entities/auth/apikey.entity';
import MissionAccessEntity from '@backend-common/entities/auth/mission-access.entity';
import BaseEntity from '@backend-common/entities/base-entity.entity';
import FileEntity from '@backend-common/entities/file/file.entity';
import IngestionJobEntity from '@backend-common/entities/file/ingestion-job.entity';
import MetadataEntity from '@backend-common/entities/metadata/metadata.entity';
import ProjectEntity from '@backend-common/entities/project/project.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';

@Unique('unique_mission_name_per_project', ['name', 'project'])
@Entity({ name: 'mission' })
export default class MissionEntity extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => ProjectEntity, (project) => project.missions, {
        nullable: false,
    })
    project?: ProjectEntity;

    @OneToMany(() => FileEntity, (file) => file.mission)
    files?: FileEntity[];

    @OneToMany(() => ActionEntity, (action) => action.mission)
    actions?: ActionEntity[];

    @OneToMany(() => IngestionJobEntity, (queue) => queue.mission)
    ingestionJobs?: IngestionJobEntity[];

    @ManyToOne(() => UserEntity, (user) => user.missions, { nullable: false })
    creator?: UserEntity;

    @OneToMany(() => ApikeyEntity, (apiKey) => apiKey.mission)
    api_keys?: ApikeyEntity[];

    @OneToMany(
        () => MissionAccessEntity,
        (missionAccess) => missionAccess.mission,
    )
    mission_accesses?: MissionAccessEntity[];

    @OneToMany(() => MetadataEntity, (tag) => tag.mission)
    tags?: MetadataEntity[];

    fileCount?: number;
    size?: number;
}
