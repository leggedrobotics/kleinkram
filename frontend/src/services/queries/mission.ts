import { Mission } from 'src/types/Mission';
import axios from 'src/api/axios';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { TagType } from 'src/types/TagType';
import { Tag } from 'src/types/Tag';
import { FileEntity } from 'src/types/FileEntity';

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
        mission.creator.avatarUrl,
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
                mission.creator.avatarUrl,
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
                    file.creator.avatarUrl,
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
