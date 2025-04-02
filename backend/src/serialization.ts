import ActionTemplate from '@common/entities/action/action-template.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import FileEntity from '@common/entities/file/file.entity';
import Project from '@common/entities/project/project.entity';
import Topic from '@common/entities/topic/topic.entity';
import Tag from '@common/entities/tag/tag.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import Action from '@common/entities/action/action.entity';
import Mission from '@common/entities/mission/mission.entity';
import User from '@common/entities/user/user.entity';

import {
    FlatMissionDto,
    MinimumMissionDto,
    MissionDto,
    MissionWithCreatorDto,
    MissionWithFilesDto,
} from '@common/api/types/mission/mission.dto';
import { ActionTemplateDto } from '@common/api/types/actions/action-template.dto';
import { ActionDto } from '@common/api/types/actions/action.dto';
import { DockerImageDto } from '@common/api/types/actions/docker-image.dto';
import { AuditLogDto } from '@common/api/types/actions/audit-log.dto';
import { ActionWorkerDto } from '@common/api/types/action-workers.dto';
import { LogsDto } from '@common/api/types/actions/logs.dto';
import { TagDto, TagTypeDto } from '@common/api/types/tags/tags.dto';
import { ProjectDto } from '@common/api/types/project/base-project.dto';
import { ProjectWithMissionCountDto } from '@common/api/types/project/project-with-mission-count.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';
import { GroupMembershipDto, UserDto } from '@common/api/types/user.dto';
import { FileDto, FileWithTopicDto } from '@common/api/types/file/file.dto';
import { TopicDto } from '@common/api/types/topic.dto';

export const missionEntityToDto = (mission: Mission): MissionDto => {
    if (!mission.project) {
        throw new Error('Mission project is not set');
    }

    return {
        ...missionEntityToMinimumDto(mission),
        project: projectEntityToDto(mission.project),
        createdAt: mission.createdAt,
        tags: mission.tags?.map(tagEntityToDto) || [],
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
        creator: userEntityToDto(mission.creator),
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
        ...(missionEntityToDtoWithCreator(mission) as MissionWithFilesDto),
        files: mission.files.map((element) => fileEntityToDto(element)),
        tags: mission.tags.map((element) => tagEntityToDto(element)),
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

export const actionTemplateEntityToDto = (
    actionTemplate: ActionTemplate,
): ActionTemplateDto => {
    return {
        uuid: actionTemplate.uuid,
        accessRights: actionTemplate.accessRights,
        command: actionTemplate.command ?? '',
        cpuCores: actionTemplate.cpuCores,
        cpuMemory: actionTemplate.cpuMemory,
        entrypoint: actionTemplate.entrypoint ?? '',
        gpuMemory: actionTemplate.gpuMemory,
        imageName: actionTemplate.image_name,
        maxRuntime: actionTemplate.maxRuntime,
        createdAt: actionTemplate.createdAt,
        name: actionTemplate.name,
        version: actionTemplate.version.toString(),
    };
};

export const actionEntityToDto = (action: Action): ActionDto => {
    if (action.createdBy === undefined) {
        throw new Error('Action must have a creator');
    }

    if (action.mission === undefined) {
        throw new Error('Action must have a mission');
    }

    if (action.template === undefined) {
        throw new Error('Action must have a template');
    }

    return {
        artifactUrl: action.artifact_url ?? '',
        artifacts: action.artifacts,
        auditLogs: (action.auditLogs as unknown as AuditLogDto[]) ?? [],
        createdAt: action.createdAt,
        creator: userEntityToDto(action.createdBy),
        image: (action.image as DockerImageDto) ?? { repoDigests: [] },
        logs: (action.logs as unknown as LogsDto[]) ?? [],
        mission: missionEntityToDto(action.mission),
        state: action.state,
        stateCause: action.state_cause ?? '',
        template: actionTemplateEntityToDto(action.template),
        updatedAt: action.updatedAt,
        uuid: action.uuid,
        worker: action.worker as ActionWorkerDto,
    };
};

export const tagTypeEntityToDto = (tagType: TagType): TagTypeDto => {
    return {
        uuid: tagType.uuid,
        createdAt: tagType.createdAt,
        updatedAt: tagType.updatedAt,
        name: tagType.name,
        description: tagType.description ?? '',
        datatype: tagType.datatype,
    };
};

export const fileEntityToDto = (file: FileEntity): FileDto => {
    if (!file.creator) {
        throw new Error('File creator is not set');
    }

    if (!file.mission) {
        throw new Error('File mission is not set');
    }

    return {
        uuid: file.uuid,
        state: file.state,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        date: file.date,
        filename: file.filename,
        type: file.type,
        size: file.size ?? 0,
        hash: file.hash ?? '',
        creator: userEntityToDto(file.creator),
        mission: missionEntityToDto(file.mission),
        categories:
            file.categories?.map((c) => ({
                uuid: c.uuid,
                name: c.name,
            })) ?? [],
    };
};

export const fileEntityToDtoWithTopic = (
    file: FileEntity,
): FileWithTopicDto => {
    if (!file.topics) {
        throw new Error('File topics are not set');
    }
    return {
        ...(fileEntityToDto(file) as FileWithTopicDto),
        topics: file.topics.map((element) => topicEntityToDto(element)),
    };
};

export const projectAccessEntityToDto = (projectAccess: ProjectAccess) => {
    if (projectAccess.accessGroup === undefined) {
        throw new Error('Access group not found');
    }

    if (projectAccess.accessGroup.memberships === undefined) {
        throw new Error('Access group has no memberships');
    }

    return {
        memberCount: projectAccess.accessGroup.memberships.length,
        type: projectAccess.accessGroup.type,
        name: projectAccess.accessGroup.name,
        rights: projectAccess.rights,
        uuid: projectAccess.accessGroup.uuid,
    };
};

export const groupMembershipEntityToDto = (
    groupMembership: GroupMembership,
): GroupMembershipDto => {
    if (groupMembership.user === undefined) {
        throw new Error('Member can never be undefined');
    }

    return {
        uuid: groupMembership.uuid,
        canEditGroup: groupMembership.canEditGroup,
        accessGroup: null, // we don't want to return the access group
        createdAt: groupMembership.createdAt,
        updatedAt: groupMembership.updatedAt,
        expirationDate: groupMembership.expirationDate ?? null,
        user: userEntityToDto(groupMembership.user),
    };
};

export const projectEntityToDto = (project: Project): ProjectDto => {
    return {
        uuid: project.uuid,
        name: project.name,
        autoConvert: project.autoConvert ?? true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        description: project.description,
    };
};

export const projectEntityToDtoWithMissionCount = (
    project: Project,
): ProjectWithMissionCountDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    return {
        ...(projectEntityToDto(project) as ProjectWithMissionCountDto),
        creator: userEntityToDto(project.creator),
        missionCount: project.missions?.length ?? 0,
    };
};

export const projectEntityToDtoWithRequiredTags = (
    project: Project,
    missionCount: number,
): ProjectWithMissionsDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    return {
        ...(projectEntityToDto(project) as ProjectWithMissionsDto),
        creator: userEntityToDto(project.creator),
        missionCount: missionCount,
        requiredTags: project.requiredTags.map((element) =>
            tagTypeEntityToDto(element),
        ),
    };
};

export const projectEntityToDtoWithMissions = (
    project: Project,
): ProjectWithMissionsDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    return {
        ...(projectEntityToDto(project) as ProjectWithMissionsDto),
        creator: userEntityToDto(project.creator),
        requiredTags: project.requiredTags.map((element) =>
            tagTypeEntityToDto(element),
        ),
        missions: project.missions?.map(missionEntityToFlatDto) ?? [],
    };
};

export const topicEntityToDto = (topic: Topic): TopicDto => {
    return {
        name: topic.name,
        type: topic.type,
        nrMessages: topic.nrMessages ?? 0n,
        frequency: Number.isNaN(topic.frequency) ? 0 : topic.frequency,
    };
};

export const tagEntityToDto = (tag: Tag): TagDto => {
    if (!tag.tagType) {
        throw new Error('TagType is not set');
    }

    return {
        get valueAsString(): string {
            return this.value.toString();
        },
        type: tagTypeEntityToDto(tag.tagType),
        value:
            tag.STRING ??
            tag.NUMBER ??
            tag.BOOLEAN ??
            tag.DATE ??
            tag.LOCATION ??
            '',
        createdAt: tag.createdAt,
        datatype: tag.tagType.datatype,
        name: tag.tagType.name,
        updatedAt: tag.updatedAt,
        uuid: tag.uuid,
    };
};

export const userEntityToDto = (user: User): UserDto => {
    return {
        uuid: user.uuid,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
    };
};
