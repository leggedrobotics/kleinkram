import { Mission } from 'src/types/Mission';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import axios from 'src/api/axios';
import { FileEntity } from 'src/types/FileEntity';
import { Topic } from 'src/types/Topic';
import {FileType} from "src/enums/FILE_ENUM";

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
        const params: Record<string, string> = {};
        if (filename) params['fileName'] = filename;
        if (projectUUID) params['projectUUID'] = projectUUID;
        if (missionUUID) params['missionUUID'] = missionUUID;
        if (startDate) params['startDate'] = formattedStartDate;
        if (endDate) params['endDate'] = formattedEndDate;
        if (topics && topics.length > 0) params['topics'] = topics.join(',');
        if (andOr !== undefined) params['andOr'] = andOr.toString();
        if (mcapBag !== undefined) params['mcapBag'] = mcapBag.toString();

        const queryParams = new URLSearchParams(params).toString();
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
                    file.creator.avatarUrl,
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
            file.creator.avatarUrl,
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
export const downloadFile = async (uuid: string, expires: boolean) => {
    const response = await axios.get('file/download', {
        params: {
            uuid,
            expires,
        },
    });
    return response.data;
};

export const filesOfMission = async (
    missionUUID: string,
    take: number,
    skip: number,
    fileType?: FileType,
    filename?: string,
): Promise<[FileEntity[], number]> => {
    const params: Record<string, string|number> = { uuid: missionUUID, take, skip };
    if (fileType) params['fileType'] = fileType;
    if (filename) params['filename'] = filename;
    const response = await axios.get('file/ofMission', {
        params,
    });
    const data = response.data[0];
    const total = response.data[1];
    if (data.length === 0) {
        return [[], 0];
    }
    const users: Record<string, User> = {};
    let missionCreator: User | undefined =
        users[data[0].mission.creator.uuid];
    if (!missionCreator) {
        missionCreator = new User(
            data[0].mission.creator.uuid,
            data[0].mission.creator.name,
            data[0].mission.creator.email,
            data[0].mission.creator.role,
            data[0].mission.creator.avatarUrl,
            [],
            new Date(data[0].mission.creator.createdAt),
            new Date(data[0].mission.creator.updatedAt),
            new Date(data[0].mission.creator.deletedAt),
        );
        users[data[0].mission.creator.uuid] = missionCreator;
    }
    const mission = new Mission(
        missionUUID,
        data[0].mission.name,
        undefined,
        [],
        [],
        missionCreator,
        new Date(data[0].mission.createdAt),
        new Date(data[0].mission.updatedAt),
        new Date(data[0].mission.deletedAt),
    );
    const res = data.map((file: any) => {
        let fileCreator: User | undefined = users[file.creator.uuid];
        if (!fileCreator) {
            fileCreator = new User(
                file.creator.uuid,
                file.creator.name,
                file.creator.email,
                file.creator.role,
                file.creator.avatarUrl,
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
    return [res, total];
};
