import axios from 'src/api/axios';
import { Project } from 'src/types/Project';
import { User } from 'src/types/User';
import { Mission } from 'src/types/Mission';
import { TagType } from 'src/types/TagType';
import { AccessGroup } from 'src/types/AccessGroup';
import { ProjectAccess } from 'src/types/ProjectAccess';

export const filteredProjects = async (
    take: number,
    skip: number,
    sortBy: string,
    descending: boolean = false,
    searchParams?: Record<string, string>,
): Promise<[Project[], number]> => {
    const params: Record<string, any> = {
        take,
        skip,
        sortBy,
        descending,
    };
    if (searchParams && Object.keys(searchParams).length > 0) {
        params['searchParams'] = searchParams;
    }
    const response = await axios.get('/project/filtered', {
        params,
    });
    const data = response.data[0];
    const total = response.data[1];
    if (data.length === 0) {
        return [[], 0];
    }
    const res = data.map((project: any) => {
        return new Project(
            project.uuid,
            project.name,
            project.description,
            project.missions.map(
                (mission: any) =>
                    new Mission(
                        mission.uuid,
                        mission.name,
                        undefined,
                        [],
                        [],
                        undefined,
                        new Date(mission.createdAt),
                        new Date(mission.updatedAt),
                    ),
            ),
            new User(
                project.creator.uuid,
                project.creator.name,
                project.creator.email,
                project.creator.role,
                project.creator.avatarUrl,
                [],
                [],
                new Date(project.creator.createdAt),
                new Date(project.creator.updatedAt),
            ),
            [],
            [],
            new Date(project.createdAt),
            new Date(project.updatedAt),
        );
    });
    return [res, total];
};

export const getProject = async (uuid: string): Promise<Project> => {
    const response = await axios.get('/project/one', { params: { uuid } });
    const project = response.data;
    const creator = new User(
        project.creator.uuid,
        project.creator.name,
        project.creator.email,
        project.creator.role,
        project.creator.avatarUrl,
        [],
        [],
        new Date(project.creator.createdAt),
        new Date(project.creator.updatedAt),
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
        );
    });
    const requiredTags = project.requiredTags.map((tag: any) => {
        return new TagType(
            tag.uuid,
            tag.name,
            tag.datatype,
            new Date(tag.createdAt),
            new Date(tag.updatedAt),
        );
    });
    const projectAccess = project.project_accesses.map((access: any) => {
        const users: User[] = [];
        if (access.accessGroup.users) {
            access.accessGroup.users.forEach((user: any) => {
                users.push(
                    new User(
                        user.uuid,
                        user.name,
                        user.email,
                        user.role,
                        user.avatarUrl,
                        [],
                        [],
                        new Date(user.createdAt),
                        new Date(user.updatedAt),
                    ),
                );
            });
        }
        const accessGroup = new AccessGroup(
            access.accessGroup.uuid,
            access.accessGroup.name,
            users,
            [],
            [],
            access.accessGroup.personal,
            access.accessGroup.inheriting,
            undefined,
            new Date(access.accessGroup.createdAt),
            new Date(access.accessGroup.updatedAt),
        );

        return new ProjectAccess(
            access.uuid,
            access.rights,
            accessGroup,
            undefined,
            new Date(access.createdAt),
            new Date(access.updatedAt),
        );
    });
    return new Project(
        project.uuid,
        project.name,
        project.description,
        missions,
        creator,
        requiredTags,
        projectAccess,
        new Date(project.createdAt),
        new Date(project.updatedAt),
    );
};

export const getDefaultAccessGroups = async (): Promise<AccessGroup[]> => {
    const response = await axios.get('/project/getDefaultRights');
    return response.data;
};
