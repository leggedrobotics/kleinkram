import { Mission } from 'src/types/Mission';
import axios from 'src/api/axios';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { TagType } from 'src/types/TagType';
import { Tag } from 'src/types/Tag';
import { FileEntity } from 'src/types/FileEntity';
import { AggregatedMission } from 'src/types/subtypes/AggregatedMission';

export const getMission = async (uuid: string): Promise<Mission> => {
    const response = await axios.get('/mission/one', { params: { uuid } });
    const mission = response.data;
    const requiredTags = mission.project.requiredTags.map((tagType: any) => {
        return new TagType(
            tagType.uuid,
            tagType.name,
            tagType.datatype,
            new Date(tagType.createdAt),
            new Date(tagType.updatedAt),
        );
    });
    const project = new Project(
        mission.project.uuid,
        mission.project.name,
        mission.project.description,
        [],
        undefined,
        requiredTags,
        undefined,
        new Date(mission.project.createdAt),
        new Date(mission.project.updatedAt),
    );
    const creator = new User(
        mission.creator.uuid,
        mission.creator.name,
        mission.creator.email,
        mission.creator.role,
        mission.creator.avatarUrl,
        [],
        [],
        new Date(mission.creator.createdAt),
        new Date(mission.creator.updatedAt),
    );
    const tags = mission.tags.map((tag: any) => {
        const tagType = new TagType(
            tag.tagType.uuid,
            tag.tagType.name,
            tag.tagType.datatype,
            new Date(tag.tagType.createdAt),
            new Date(tag.tagType.updatedAt),
        );
        return new Tag(
            tag.uuid,
            tag.STRING,
            tag.NUMBER ? parseInt(tag.NUMBER) : tag.NUMBER,
            tag.BOOLEAN ? !!tag.BOOLEAN : tag.BOOLEAN,
            tag.DATE ? new Date(tag.DATE) : tag.DATE,
            tag.LOCATION,
            tagType,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
        );
    });
    return new Mission(
        mission.uuid,
        mission.name,
        project,
        [],
        tags,
        creator,
        new Date(mission.createdAt),
        new Date(mission.updatedAt),
    );
};

export const missionsOfProjectMinimal = async (
    projectUUID: string,
    take: number = 100,
    skip: number = 0,
    sortBy: string = 'createdAt',
    descending: boolean = false,
    searchParams?: {
        name: string;
    },
): Promise<[Mission[], number]> => {
    if (!projectUUID) {
        return [[], 0];
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        descending,
    };
    if (searchParams && searchParams.name) {
        params['search'] = searchParams.name;
    }
    const response = await axios.get(`/mission/filteredMinimal`, {
        params,
    });
    const data = response.data[0];
    const total = response.data[1];
    if (data.length === 0) {
        return [[], 0];
    }
    const users: Record<string, User> = {};
    const res = data.map((mission: any) => {
        const project = new Project(
            mission.project.uuid,
            mission.project.name,
            mission.project.description,
            [],
            undefined,
            undefined,
            undefined,
            new Date(mission.project.createdAt),
            new Date(mission.project.updatedAt),
        );
        let missionCreator: User | undefined = users[mission.creator.uuid];
        if (!missionCreator) {
            missionCreator = new User(
                mission.creator.uuid,
                mission.creator.name,
                mission.creator.email,
                mission.creator.role,
                mission.creator.avatarUrl,
                [],
                [],
                new Date(mission.creator.createdAt),
                new Date(mission.creator.updatedAt),
            );
            users[mission.creator.uuid] = missionCreator;
        }

        return new Mission(
            mission.uuid,
            mission.name,
            project,
            [],
            [],
            missionCreator,
            new Date(mission.createdAt),
            new Date(mission.updatedAt),
        );
    });
    return [res, total];
};

export const missionsOfProject = async (
    projectUUID: string,
    take: number = 100,
    skip: number = 0,
    sortBy: string = 'createdAt',
    descending: boolean = false,
    searchParams?: {
        name: string;
    },
): Promise<[Mission[], number]> => {
    if (!projectUUID) {
        return [[], 0];
    }
    const params: Record<string, any> = {
        uuid: projectUUID,
        take,
        skip,
        sortBy,
        descending,
    };
    if (searchParams && searchParams.name) {
        params['search'] = searchParams.name;
    }
    const response = await axios.get(`/mission/filtered`, {
        params,
    });
    const data = response.data[0];
    const total = response.data[1];
    if (data.length === 0) {
        return [[], 0];
    }
    const res = data.map((mission: any) => {
        try {
            return AggregatedMission.fromAPIResponse(mission);
        } catch (e) {
            console.error(e);
            return null;
        }
    });
    return [res, total];
};

export const getMissions = async (uuids: string[]): Promise<Mission[]> => {
    const response = await axios.get('/mission/many', { params: { uuids } });
    const data = response.data;
    if (data.length === 0) {
        return [];
    }
    const users: Record<string, User> = {};
    return data.map((mission: any) => {
        const project = new Project(
            mission.project.uuid,
            mission.project.name,
            mission.project.description,
            [],
            undefined,
            undefined,
            undefined,
            new Date(mission.project.createdAt),
            new Date(mission.project.updatedAt),
        );
        let missionCreator: User | undefined = users[mission.creator.uuid];
        if (!missionCreator) {
            missionCreator = new User(
                mission.creator.uuid,
                mission.creator.name,
                mission.creator.email,
                mission.creator.role,
                mission.creator.avatarUrl,
                [],
                [],
                new Date(mission.creator.createdAt),
                new Date(mission.creator.updatedAt),
            );
            users[mission.creator.uuid] = missionCreator;
        }

        return new Mission(
            mission.uuid,
            mission.name,
            project,
            [],
            [],
            missionCreator,
            new Date(mission.createdAt),
            new Date(mission.updatedAt),
        );
    });
};
