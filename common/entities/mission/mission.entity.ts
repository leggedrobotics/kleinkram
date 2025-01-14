import { Column, Entity, ManyToOne, OneToMany, Unique } from 'typeorm';
import BaseEntity from '../base-entity.entity';
import Project from '../project/project.entity';
import FileEntity from '../file/file.entity';
import QueueEntity from '../queue/queue.entity';
import User from '../user/user.entity';
import Apikey from '../auth/apikey.entity';
import Tag from '../tag/tag.entity';
import MissionAccess from '../auth/mission-access.entity';
import Action from '../action/action.entity';
import {
    FlatMissionDto,
    MinimumMissionDto,
    MissionDto,
    MissionWithCreatorDto,
    MissionWithFilesDto,
} from '../../api/types/mission/mission.dto';

@Unique('unique_mission_name_per_project', ['name', 'project'])
@Entity()
export default class Mission extends BaseEntity {
    @Column()
    name!: string;

    @ManyToOne(() => Project, (project) => project.missions, {
        nullable: false,
    })
    project?: Project;

    @OneToMany(() => FileEntity, (file) => file.mission)
    files?: FileEntity[];

    @OneToMany(() => Action, (action) => action.mission)
    actions?: Action[];

    @OneToMany(() => QueueEntity, (queue) => queue.mission)
    queues?: QueueEntity[];

    @ManyToOne(() => User, (user) => user.missions, { nullable: false })
    creator?: User;

    @OneToMany(() => Apikey, (apiKey) => apiKey.mission)
    api_keys?: Apikey[];

    @OneToMany(() => MissionAccess, (missionAccess) => missionAccess.mission)
    mission_accesses?: MissionAccess[];

    @OneToMany(() => Tag, (tag) => tag.mission)
    tags?: Tag[];

    get missionDto(): MissionDto {
        if (!this.project) {
            throw new Error('Mission project is not set');
        }

        return {
            ...this.minimumMissionDto,
            project: this.project.minimalProjectDto,
            createdAt: this.createdAt,
            tags: this.tags?.map((tag) => tag.tagDto) || [],
            updatedAt: this.updatedAt,
        };
    }

    get missionWithCreatorDto(): MissionWithCreatorDto {
        if (!this.creator) {
            throw new Error('Mission creator is not set');
        }

        return {
            ...this.missionDto,
            creator: this.creator.userDto,
        };
    }

    get flatMissionDto(): FlatMissionDto {
        return {
            ...this.missionWithCreatorDto,
            filesCount: this.files?.length || 0,
            size:
                this.files?.reduce(
                    (accumulator, file) => accumulator + (file.size ?? 0),
                    0,
                ) || 0,
        };
    }

    get missionWithFilesDto(): MissionWithFilesDto {
        if (!this.files) {
            throw new Error('Mission files are not set');
        }

        if (!this.tags) {
            throw new Error('Mission creator is not set');
        }

        return {
            ...this.missionWithCreatorDto,
            files: this.files.map((file) => file.fileDto),
            tags: this.tags.map((tag) => tag.tagDto),
        };
    }

    get minimumMissionDto(): MinimumMissionDto {
        return {
            name: this.name,
            uuid: this.uuid,
        };
    }
}
