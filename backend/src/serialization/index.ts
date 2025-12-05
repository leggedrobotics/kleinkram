import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';

import {
    CurrentAPIUserDto,
    FileDto,
    FileWithTopicDto,
    FlatMissionDto,
    GroupMembershipDto,
    MinimumMissionDto,
    MissionDto,
    MissionWithCreatorDto,
    MissionWithFilesDto,
    ProjectDto,
    ProjectWithMissionsDto,
    ProjectWithRequiredTagsDto,
    TagDto,
    TagTypeDto,
    TopicDto,
    UserDto,
} from '@kleinkram/api-dto';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';

export const userEntityToDto = (
    user: UserEntity,
    includeEmail = false,
): UserDto => {
    return {
        uuid: user.uuid,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        email: includeEmail && user.email ? user.email : null,
    };
};

export const userEntityToCurrentAPIUserDto = (
    user: UserEntity,
): CurrentAPIUserDto => {
    return {
        ...userEntityToDto(user, true),
        role: user.role ?? UserRole.USER,
        memberships:
            user.memberships?.map((m) =>
                groupMembershipEntityToDto(m, false, user),
            ) ?? [],
    };
};

export const missionEntityToDto = (mission: MissionEntity): MissionDto => {
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
    mission: MissionEntity,
): MissionWithCreatorDto => {
    if (!mission.creator) {
        throw new Error('Mission creator is not set');
    }

    return {
        ...missionEntityToDto(mission),
        creator: userEntityToDto(mission.creator),
    };
};

export const missionEntityToFlatDto = (
    mission: MissionEntity,
): FlatMissionDto => {
    return {
        ...missionEntityToDtoWithCreator(mission),
        filesCount: mission.fileCount ?? 0,
        size: mission.size ?? 0,
    };
};

export const missionEntityToDtoWithFiles = (
    mission: MissionEntity,
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
    mission: MissionEntity,
): MinimumMissionDto => {
    return {
        name: mission.name,
        uuid: mission.uuid,
    };
};

export const tagTypeEntityToDto = (tagType: TagTypeEntity): TagTypeDto => {
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

    const relatedUuid = file.parent?.uuid ?? file.derivedFiles?.[0]?.uuid;

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
        relatedFileUuid: relatedUuid,
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
    let topics = file.topics ?? [];

    // Fallback: no topics on this file, check derived files
    if (topics.length === 0 && file.derivedFiles?.length) {
        const derivedWithTopics = file.derivedFiles.find(
            (f) => f.topics && f.topics.length > 0,
        );
        if (derivedWithTopics) {
            topics = derivedWithTopics.topics ?? [];
        }
    }

    // Fallback: child file without topics, check parent
    if (topics.length === 0 && file.parent?.topics?.length) {
        topics = file.parent.topics;
    }

    if (!topics) topics = [];

    return {
        ...(fileEntityToDto(file) as FileWithTopicDto),
        topics: topics.map((element) => topicEntityToDto(element)),
    };
};

export const projectAccessEntityToDto = (
    projectAccess: ProjectAccessEntity,
): {
    memberCount: number;
    type: AccessGroupType;
    name: string;
    rights: AccessGroupRights;
    uuid: string;
} => {
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
    groupMembership: GroupMembershipEntity,
    includeEmail = false,
    userOverride?: UserEntity,
): GroupMembershipDto => {
    const user = groupMembership.user ?? userOverride;
    console.log('groupMembershipEntityToDto debug:', {
        gmUuid: groupMembership.uuid,
        hasUser: !!groupMembership.user,
        hasOverride: !!userOverride,
        resolvedUser: !!user,
    });

    if (user === undefined) {
        throw new Error('Member can never be undefined');
    }

    return {
        uuid: groupMembership.uuid,
        canEditGroup: groupMembership.canEditGroup,
        accessGroup: null, // we don't want to return the access group
        createdAt: groupMembership.createdAt,
        updatedAt: groupMembership.updatedAt,
        expirationDate: groupMembership.expirationDate ?? null,
        user: userEntityToDto(user, includeEmail),
    };
};

export const projectEntityToDto = (project: ProjectEntity): ProjectDto => {
    return {
        uuid: project.uuid,
        name: project.name,
        autoConvert: project.autoConvert ?? true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        description: project.description,
    };
};

export const projectEntityToDtoWithRequiredTags = (
    project: ProjectEntity,
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

export const projectEntityToDtoWithMissionCountAndTags = (
    project: ProjectEntity,
): ProjectWithRequiredTagsDto => {
    if (project.creator === undefined) {
        throw new Error('Creator can never be undefined');
    }

    return {
        ...(projectEntityToDto(project) as ProjectWithRequiredTagsDto),
        creator: userEntityToDto(project.creator),
        missionCount: project.missionCount ?? 0,
        requiredTags: project.requiredTags?.map(tagTypeEntityToDto) ?? [],
    };
};

export const topicEntityToDto = (topic: TopicEntity): TopicDto => {
    return {
        name: topic.name,
        type: topic.type,
        nrMessages: topic.nrMessages ?? 0n,
        frequency: Number.isNaN(topic.frequency) ? 0 : topic.frequency,
    };
};

export const tagEntityToDto = (tag: MetadataEntity): TagDto => {
    if (!tag.tagType) {
        throw new Error('TagType is not set');
    }

    return {
        get valueAsString(): string {
            return this.value.toString();
        },
        type: tagTypeEntityToDto(tag.tagType),
        value:
            tag.value_string ??
            tag.value_number ??
            tag.value_boolean ??
            tag.value_date ??
            tag.value_location ??
            '',
        createdAt: tag.createdAt,
        datatype: tag.tagType.datatype,
        name: tag.tagType.name,
        updatedAt: tag.updatedAt,
        uuid: tag.uuid,
    };
};
