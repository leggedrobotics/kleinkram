import axios from 'src/api/axios';

import { ProjectAccess } from 'src/types/ProjectAccess';
import { AccessGroup } from 'src/types/AccessGroup';
import { Mission } from 'src/types/Mission';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { FileEntity } from 'src/types/FileEntity';
import { Action } from 'src/types/Action';
import { Tag } from 'src/types/Tag';
import { TagType } from 'src/types/TagType';
import { Queue } from 'src/types/Queue';
import { Topic } from 'src/types/Topic';

export const fetchOverview = async (
    filename: string,
    projectUUID: string | undefined,
    missionUUID: string | undefined,
    startDate: Date,
    endDate: Date,
    topics: string[],
    andOr: boolean,
    mcapBag: boolean,
): Promise<Mission[]> => {
    try {
        const formattedStartDate = startDate.toISOString();
        const formattedEndDate = endDate.toISOString();

        const queryParams = new URLSearchParams({
            fileName: filename || '',
            projectUUID: projectUUID || '',
            missionUUID: missionUUID || '',
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            topics: topics.join(','),
            andOr: andOr ? '1' : '',
            mcapBag: mcapBag ? '1' : '',
        }).toString();
        const projects: Record<string, Project> = {};
        const creator: Record<string, User> = {};
        const missions: Record<string, Mission> = {};
        const response = await axios.get(`/file/filtered?${queryParams}`);
        return response.data.map((file: any) => {
            const project_uuid: string = file.mission.project.uuid;
            let project: Project | undefined = projects[project_uuid];
            if (!project) {
                project = new Project(
                    file.mission.project.uuid,
                    file.mission.project.name,
                    file.mission.project.description,
                    [],
                    file.mission.project.creator,
                    undefined,
                    new Date(file.mission.project.createdAt),
                    new Date(file.mission.project.updatedAt),
                    new Date(file.mission.project.deletedAt),
                );
            }
            let user: User | undefined = creator[file.creator.uuid];
            if (!user) {
                user = new User(
                    file.creator.uuid,
                    file.creator.name,
                    file.creator.email,
                    file.creator.role,
                    file.creator.googleId,
                    [],
                    new Date(file.creator.createdAt),
                    new Date(file.creator.updatedAt),
                    new Date(file.creator.deletedAt),
                );
                creator[file.creator.uuid] = user;
            }
            const mission_uuid: string = file.mission.uuid;
            let mission: Mission | undefined = missions[mission_uuid];
            if (!mission) {
                mission = new Mission(
                    file.mission.uuid,
                    file.mission.name,
                    project,
                    [],
                    [],
                    file.mission.creator,
                    new Date(file.mission.createdAt),
                    new Date(file.mission.updatedAt),
                    new Date(file.mission.deletedAt),
                );
            }
            const newFile = new FileEntity(
                file.uuid,
                file.filename,
                mission,
                user,
                new Date(file.date),
                file.topics,
                file.size,
                file.type,
                new Date(file.createdAt),
                new Date(file.updatedAt),
                new Date(file.deletedAt),
            );
            mission.files.push(newFile);
            return newFile;
        });
    } catch (error) {
        console.error('Error fetching overview:', error);
        throw error; // Rethrow or handle as appropriate
    }
};

export const allProjects = async () => {
    const response = await axios.get('/project');
    return response.data;
};

export const actions = async (projectUUID: string, missionUUIDs: string) => {
    const params = {
        project_uuid: projectUUID,
        mission_uuids: missionUUIDs,
    };

    const response = await axios.get('/action/list', { params });
    return response.data.map((res: any) => {
        return new Action(
            res.uuid,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
            res.state,
            res.docker_image,
            null,
        );
    });
};

export const actionDetails = async (action_uuid: string) => {
    const params = {
        uuid: action_uuid,
    };

    const response = await axios.get('/action/details', { params });
    return new Action(
        response.data.uuid,
        new Date(response.data.createdAt),
        new Date(response.data.updatedAt),
        new Date(response.data.deletedAt),
        response.data.state,
        response.data.docker_image,
        null,
        response.data.logs,
    );
};

export const getMission = async (uuid: string): Promise<Mission> => {
    const response = await axios.get('/mission/one', { params: { uuid } });
    const mission = response.data;
    const project = new Project(
        mission.project.uuid,
        mission.project.name,
        mission.project.description,
        [],
        undefined,
        undefined,
        new Date(mission.project.createdAt),
        new Date(mission.project.updatedAt),
        new Date(mission.project.deletedAt),
    );
    const creator = new User(
        mission.creator.uuid,
        mission.creator.name,
        mission.creator.email,
        mission.creator.role,
        mission.creator.googleId,
        [],
        new Date(mission.creator.createdAt),
        new Date(mission.creator.updatedAt),
        new Date(mission.creator.deletedAt),
    );
    const tags = mission.tags.map((tag: any) => {
        const tagType = new TagType(
            tag.tagType.uuid,
            tag.tagType.name,
            tag.tagType.datatype,
            new Date(tag.tagType.createdAt),
            new Date(tag.tagType.updatedAt),
            new Date(tag.tagType.deletedAt),
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
            new Date(tag.deletedAt),
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
        new Date(mission.deletedAt),
    );
};
export const currentQueue = async (startDate: Date) => {
    const params = {
        startDate: startDate.toISOString(),
    };
    const response = await axios.get('/queue/active', { params });
    const users: Record<string, User> = {};
    return response.data.map((res: any) => {
        let creator: User | undefined = users[res.creator.uuid];
        if (!creator) {
            creator = new User(
                res.creator.uuid,
                res.creator.name,
                res.creator.email,
                res.creator.role,
                res.creator.googleId,
                [],
                new Date(res.creator.createdAt),
                new Date(res.creator.updatedAt),
                new Date(res.creator.deletedAt),
            );
            users[res.creator.uuid] = creator;
        }
        return new Queue(
            res.uuid,
            res.identifier,
            res.filename,
            res.state,
            res.location,
            res.mission,
            creator,
            new Date(res.createdAt),
            new Date(res.updatedAt),
            new Date(res.deletedAt),
        );
    });
};

export const fetchFile = async (uuid: string): Promise<FileEntity> => {
    try {
        const response = await axios.get('/file/one', { params: { uuid } });
        const file = response.data;
        const project = new Project(
            file.mission.project.uuid,
            file.mission.project.name,
            file.mission.project.description,
            [],
            undefined,
            undefined,
            new Date(file.mission.project.createdAt),
            new Date(file.mission.project.updatedAt),
            new Date(file.mission.project.deletedAt),
        );

        const mission = new Mission(
            file.mission.uuid,
            file.mission.name,
            project,
            [],
            [],
            undefined,
            new Date(file.mission.createdAt),
            new Date(file.mission.updatedAt),
            new Date(file.mission.deletedAt),
        );
        const creator = new User(
            file.creator.uuid,
            file.creator.name,
            file.creator.email,
            file.creator.role,
            file.creator.googleId,
            [],
            new Date(file.creator.createdAt),
            new Date(file.creator.updatedAt),
            new Date(file.creator.deletedAt),
        );

        project.missions.push(mission);
        const topics = file.topics.map((topic: any) => {
            return new Topic(
                topic.uuid,
                topic.name,
                topic.type,
                topic.nrMessages,
                topic.frequency,
                new Date(topic.createdAt),
                new Date(topic.updatedAt),
                new Date(topic.deletedAt),
            );
        });
        const newFile = new FileEntity(
            file.uuid,
            file.filename,
            mission,
            creator,
            new Date(file.date),
            topics,
            file.size,
            file.type,
            new Date(file.createdAt),
            new Date(file.updatedAt),
            new Date(file.deletedAt),
        );
        mission.files.push(newFile);
        return newFile;
    } catch (error) {
        console.error('Error fetching file:', error);
        throw error; // Rethrow or handle as appropriate
    }
};

export const allTopics = async () => {
    const response = await axios.get('/topic/all');
    return response.data;
};

export const downloadFile = async (uuid: string, expires: boolean) => {
    const response = await axios.get('file/download', {
        params: {
            uuid,
            expires,
        },
    });
    return response.data;
};

export const allTopicsNames = async (): Promise<string[]> => {
    const response = await axios.get('/topic/names');
    return response.data;
};

export const missionsOfProject = async (
    projectUUID: string,
): Promise<Mission[]> => {
    const response = await axios.get(`/mission/filtered`, {
        params: { uuid: projectUUID },
    });
    const users: Record<string, User> = {};
    return response.data.map((mission: any) => {
        const project = new Project(
            mission.project.uuid,
            mission.project.name,
            mission.project.description,
            [],
            undefined,
            undefined,
            new Date(mission.project.createdAt),
            new Date(mission.project.updatedAt),
            new Date(mission.project.deletedAt),
        );
        let missionCreator: User | undefined = users[mission.creator.uuid];
        if (!missionCreator) {
            missionCreator = new User(
                mission.creator.uuid,
                mission.creator.name,
                mission.creator.email,
                mission.creator.role,
                mission.creator.googleId,
                [],
                new Date(mission.creator.createdAt),
                new Date(mission.creator.updatedAt),
                new Date(mission.creator.deletedAt),
            );
            users[mission.creator.uuid] = missionCreator;
        }
        const missionEntity = new Mission(
            mission.uuid,
            mission.name,
            project,
            [],
            [],
            missionCreator,
            new Date(mission.createdAt),
            new Date(mission.updatedAt),
            new Date(mission.deletedAt),
        );
        missionEntity.files = mission.files.map((file: any) => {
            let fileCreator: User | undefined = users[file.creator.uuid];
            if (!fileCreator) {
                fileCreator = new User(
                    file.creator.uuid,
                    file.creator.name,
                    file.creator.email,
                    file.creator.role,
                    file.creator.googleId,
                    [],
                    new Date(file.creator.createdAt),
                    new Date(file.creator.updatedAt),
                    new Date(file.creator.deletedAt),
                );
                users[file.creator.uuid] = fileCreator;
            }
            return new FileEntity(
                file.uuid,
                file.filename,
                null,
                fileCreator,
                new Date(file.date),
                file.topics,
                file.size,
                file.type,
                new Date(file.createdAt),
                new Date(file.updatedAt),
                new Date(file.deletedAt),
            );
        });
        return missionEntity;
    });
};

export const filesOfMission = async (
    missionUUID: string,
): Promise<FileEntity[]> => {
    const response = await axios.get('file/ofMission', {
        params: { uuid: missionUUID },
    });
    if (response.data.length === 0) {
        return [];
    }
    const users: Record<string, User> = {};
    let missionCreator: User | undefined =
        users[response.data[0].mission.creator.uuid];
    if (!missionCreator) {
        missionCreator = new User(
            response.data[0].mission.creator.uuid,
            response.data[0].mission.creator.name,
            response.data[0].mission.creator.email,
            response.data[0].mission.creator.role,
            response.data[0].mission.creator.googleId,
            [],
            new Date(response.data[0].mission.creator.createdAt),
            new Date(response.data[0].mission.creator.updatedAt),
            new Date(response.data[0].mission.creator.deletedAt),
        );
        users[response.data[0].mission.creator.uuid] = missionCreator;
    }
    const mission = new Mission(
        missionUUID,
        response.data[0].mission.name,
        undefined,
        [],
        [],
        missionCreator,
        new Date(response.data[0].mission.createdAt),
        new Date(response.data[0].mission.updatedAt),
        new Date(response.data[0].mission.deletedAt),
    );
    return response.data.map((file: any) => {
        let fileCreator: User | undefined = users[file.creator.uuid];
        if (!fileCreator) {
            fileCreator = new User(
                file.creator.uuid,
                file.creator.name,
                file.creator.email,
                file.creator.role,
                file.creator.googleId,
                [],
                new Date(file.creator.createdAt),
                new Date(file.creator.updatedAt),
                new Date(file.creator.deletedAt),
            );
            users[file.creator.uuid] = fileCreator;
        }
        const topics = file.topics.map((topic: any) => {
            return new Topic(
                topic.uuid,
                topic.name,
                topic.type,
                topic.nrMessages,
                topic.frequency,
                new Date(topic.createdAt),
                new Date(topic.updatedAt),
                new Date(topic.deletedAt),
            );
        });
        const newFile = new FileEntity(
            file.uuid,
            file.filename,
            mission,
            fileCreator,
            new Date(file.date),
            topics,
            file.size,
            file.type,
            new Date(file.createdAt),
            new Date(file.updatedAt),
            new Date(file.deletedAt),
        );
        mission.files.push(newFile);
        return newFile;
    });
};

export const getProject = async (uuid: string): Promise<Project> => {
    const response = await axios.get('/project/one', { params: { uuid } });
    const project = response.data;
    const creator = new User(
        project.creator.uuid,
        project.creator.name,
        project.creator.email,
        project.creator.role,
        project.creator.googleId,
        [],
        new Date(project.creator.createdAt),
        new Date(project.creator.updatedAt),
        new Date(project.creator.deletedAt),
    );
    const missions: Mission[] = project.missions.map((mission: any) => {
        return new Mission(
            mission.uuid,
            mission.name,
            undefined,
            [],
            [],
            undefined,
            new Date(mission.createdAt),
            new Date(mission.updatedAt),
            new Date(mission.deletedAt),
        );
    });
    const requiredTags = project.requiredTags.map((tag: any) => {
        return new TagType(
            tag.uuid,
            tag.name,
            tag.datatype,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
            new Date(tag.deletedAt),
        );
    });
    const projectAccess = project.project_accesses.map((access: any) => {
        const accessGroup = new AccessGroup(
            access.accessGroup.uuid,
            access.accessGroup.name,
            [],
            [],
            [],
            access.accessGroup.personal,
            access.accessGroup.inheriting,
            new Date(access.accessGroup.createdAt),
            new Date(access.accessGroup.updatedAt),
            new Date(access.accessGroup.deletedAt),
        );

        return new ProjectAccess(
            access.uuid,
            access.rights,
            accessGroup,
            [],
            new Date(access.createdAt),
            new Date(access.updatedAt),
            new Date(access.deletedAt),
        );
    });
    return new Project(
        project.uuid,
        project.name,
        project.description,
        missions,
        creator,
        requiredTags,
        new Date(project.createdAt),
        new Date(project.updatedAt),
        new Date(project.deletedAt),
    );
};

export const getTagTypes = async () => {
    const response = await axios.get('/tag/all');
    return response.data.map((tag: any) => {
        return new TagType(
            tag.uuid,
            tag.name,
            tag.datatype,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
            new Date(tag.deletedAt),
        );
    });
};
