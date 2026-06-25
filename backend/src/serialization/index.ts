import { AccessGroupEntity, ApiKeyEntity } from '@kleinkram/backend-common';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';

import {
    AccessGroupDto,
    ApiKeyMetadataDto,
    CurrentAPIUserDto,
    FileDto,
    FileWithTopicDto,
    FlatMissionDto,
    GroupMembershipDto,
    MinimumMissionDto,
    MissionDto,
    MissionWithCreatorDto,
    MissionWithFilesDto,
    ProjectAccessDto,
    ProjectDto,
    ProjectWithRequiredTagsDto,
    TagDto,
    TagTypeDto,
    TopicDto,
    UserDto,
} from '@kleinkram/api-dto';
import { plainToInstance } from 'class-transformer';

export const userEntityToDto = (
    user: UserEntity,
    includeEmail = false,
): UserDto => {
    return plainToInstance(UserDto, user, {
        excludeExtraneousValues: true,
        groups: includeEmail ? ['includeEmail'] : [],
    });
};

export const userEntityToCurrentAPIUserDto = (
    user: UserEntity,
): CurrentAPIUserDto => {
    // If memberships are present, ensure they have the user populated
    const memberships = user.memberships?.map((m) => {
        if (!m.user) {
            const copy = Object.create(
                Object.getPrototypeOf(m) as object,
            ) as GroupMembershipEntity;
            Object.assign(copy, m, { user });
            return copy;
        }
        return m;
    });

    const userCopy = Object.create(
        Object.getPrototypeOf(user) as object,
    ) as UserEntity;
    Object.assign(userCopy, user, { memberships });

    return plainToInstance(CurrentAPIUserDto, userCopy, {
        excludeExtraneousValues: true,
        groups: ['includeEmail', 'includeAccessGroup'],
    });
};

export const missionEntityToDto = (mission: MissionEntity): MissionDto => {
    if (!mission.project) {
        throw new Error('Mission project is not set');
    }

    return plainToInstance(MissionDto, mission, {
        excludeExtraneousValues: true,
    });
};

export const missionEntityToDtoWithCreator = (
    mission: MissionEntity,
): MissionWithCreatorDto => {
    if (!mission.creator) {
        throw new Error('Mission creator is not set');
    }

    return plainToInstance(MissionWithCreatorDto, mission, {
        excludeExtraneousValues: true,
    });
};

export const missionEntityToFlatDto = (
    mission: MissionEntity,
): FlatMissionDto => {
    if (!mission.creator) {
        throw new Error('Mission creator is not set');
    }

    return plainToInstance(FlatMissionDto, mission, {
        excludeExtraneousValues: true,
    });
};

export const missionEntityToDtoWithFiles = (
    mission: MissionEntity,
): MissionWithFilesDto => {
    if (!mission.files) {
        throw new Error('Mission files are not set');
    }

    if (!mission.tags) {
        throw new Error('Mission tags are not set');
    }

    if (!mission.creator) {
        throw new Error('Mission creator is not set');
    }

    return plainToInstance(MissionWithFilesDto, mission, {
        excludeExtraneousValues: true,
    });
};

export const missionEntityToMinimumDto = (
    mission: MissionEntity,
): MinimumMissionDto => {
    return plainToInstance(MinimumMissionDto, mission, {
        excludeExtraneousValues: true,
    });
};

export const tagTypeEntityToDto = (tagType: TagTypeEntity): TagTypeDto => {
    return plainToInstance(TagTypeDto, tagType, {
        excludeExtraneousValues: true,
    });
};

export const fileEntityToDto = (file: FileEntity): FileDto => {
    if (!file.creator) {
        throw new Error('File creator is not set');
    }

    if (!file.mission) {
        throw new Error('File mission is not set');
    }

    return plainToInstance(FileDto, file, {
        excludeExtraneousValues: true,
    });
};

export const fileEntityToDtoWithTopic = (
    file: FileEntity,
): FileWithTopicDto => {
    if (!file.creator) {
        throw new Error('File creator is not set');
    }

    if (!file.mission) {
        throw new Error('File mission is not set');
    }

    return plainToInstance(FileWithTopicDto, file, {
        excludeExtraneousValues: true,
    });
};

export const projectAccessEntityToDto = (
    projectAccess: ProjectAccessEntity,
): ProjectAccessDto => {
    if (projectAccess.accessGroup === undefined) {
        throw new Error('Access group not found');
    }

    if (projectAccess.accessGroup.memberships === undefined) {
        throw new Error('Access group has no memberships');
    }

    return plainToInstance(ProjectAccessDto, projectAccess, {
        excludeExtraneousValues: true,
    });
};

export function groupMembershipEntityToDto(
    groupMembership: GroupMembershipEntity,
    includeEmail = false,
    userOverride?: UserEntity,
    includeAccessGroup = false,
): GroupMembershipDto {
    const user = groupMembership.user ?? userOverride;

    if (user === undefined) {
        throw new Error('Member can never be undefined');
    }

    const groups: string[] = [];
    if (includeEmail) groups.push('includeEmail');
    if (includeAccessGroup) groups.push('includeAccessGroup');

    const copy = Object.create(
        Object.getPrototypeOf(groupMembership) as object,
    ) as GroupMembershipEntity;
    Object.assign(copy, groupMembership, { user });

    return plainToInstance(GroupMembershipDto, copy, {
        excludeExtraneousValues: true,
        groups,
    });
}

export const projectEntityToDto = (project: ProjectEntity): ProjectDto => {
    return plainToInstance(ProjectDto, project, {
        excludeExtraneousValues: true,
    });
};

export const projectEntityToDtoWithRequiredTags = (
    project: ProjectEntity,
    missionCount: number,
): ProjectWithRequiredTagsDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    const copy = Object.create(
        Object.getPrototypeOf(project) as object,
    ) as ProjectEntity;
    Object.assign(copy, project, { missionCount });

    return plainToInstance(ProjectWithRequiredTagsDto, copy, {
        excludeExtraneousValues: true,
    });
};

export const projectEntityToDtoWithMissionCountAndTags = (
    project: ProjectEntity,
): ProjectWithRequiredTagsDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    return plainToInstance(ProjectWithRequiredTagsDto, project, {
        excludeExtraneousValues: true,
    });
};

export const topicEntityToDto = (topic: TopicEntity): TopicDto => {
    return plainToInstance(TopicDto, topic, {
        excludeExtraneousValues: true,
    });
};

export const tagEntityToDto = (tag: MetadataEntity): TagDto => {
    if (!tag.tagType) {
        throw new Error('TagType is not set');
    }

    return plainToInstance(TagDto, tag, {
        excludeExtraneousValues: true,
    });
};

export function accessGroupEntityToDto(
    accessGroup: AccessGroupEntity,
): AccessGroupDto {
    return plainToInstance(AccessGroupDto, accessGroup, {
        excludeExtraneousValues: true,
    });
}

export const apiKeyEntityToMetadataDto = (
    apiKey: ApiKeyEntity,
): ApiKeyMetadataDto => {
    return plainToInstance(ApiKeyMetadataDto, apiKey, {
        excludeExtraneousValues: true,
    });
};
