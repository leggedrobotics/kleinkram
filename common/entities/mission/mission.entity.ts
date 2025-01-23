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
        return missionEntityToDto(this);
        
    }

    get missionWithCreatorDto(): MissionWithCreatorDto {
        return missionEntityToDtoWithCreator(this);
    }

    get flatMissionDto(): FlatMissionDto {
        return missionEntityToFlatDto(this);
    }

    get missionWithFilesDto(): MissionWithFilesDto {
        return missionEntityToDtoWithFiles(this);
    }

    get minimumMissionDto(): MinimumMissionDto {
        return missionEntityToMinimumDto(this);
    }
}

export const missionEntityToDto = (mission: Mission): MissionDto => {
    if (!mission.project) {
        throw new Error('Mission project is not set');
    }

    return {
        ...mission.minimumMissionDto,
        project: mission.project.projectDto,
        createdAt: mission.createdAt,
        tags: mission.tags?.map((tag) => tag.tagDto) || [],
        updatedAt: mission.updatedAt,
    };
};

export const missionEntityToDtoWithCreator = (
    mission: Mission,
): MissionWithCreatorDto => {
    if (!mission.creator) {
        throw new Error('Mission creator is not set');
    }

    return {
        ...missionEntityToDto(mission),
        creator: mission.creator.userDto,
    };
};

export const missionEntityToFlatDto = (mission: Mission): FlatMissionDto => {
    return {
        ...missionEntityToDtoWithCreator(mission),
        filesCount: mission.files?.length || 0,
        size:
            mission.files?.reduce(
                (accumulator, file) => accumulator + (file.size ?? 0),
                0,
            ) || 0,
    };
};

export const missionEntityToDtoWithFiles = (
    mission: Mission,
): MissionWithFilesDto => {
    if (!mission.files) {
        throw new Error('Mission files are not set');
    }

    if (!mission.tags) {
        throw new Error('Mission creator is not set');
    }

    return {
        ...missionEntityToDtoWithCreator(mission),
        files: mission.files.map((file) => file.fileDto),
        tags: mission.tags.map((tag) => tag.tagDto),
    };
};

export const missionEntityToMinimumDto = (
    mission: Mission,
): MinimumMissionDto => {
    return {
        name: mission.name,
        uuid: mission.uuid,
    };
};
