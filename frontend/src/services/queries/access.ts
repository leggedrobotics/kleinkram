import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';
import { User } from 'src/types/User';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { Project } from 'src/types/Project';

export const canAddAccessGroup = async (
    project_uuid: string,
): Promise<boolean> => {
    if (!project_uuid) {
        return false;
    }
    const response = await axios.get('/access/canAddAccessGroupToProject', {
        params: { uuid: project_uuid },
    });

    return response.data;
};

export const searchAccessGroups = async (
    search: string,
    personal: boolean,
    creator: boolean,
    member: boolean,
    skip: number,
    take: number,
): Promise<[AccessGroup[], 0]> => {
    const params: Record<string, string | boolean | number> = {
        skip,
        take,
    };
    if (search) {
        params['search'] = search;
    }
    if (personal) {
        params['personal'] = true;
    }
    if (creator) {
        params['creator'] = true;
    }
    if (member) {
        params['member'] = true;
    }
    const response = await axios.get('/access/searchAccessGroup', {
        params,
    });
    if (!response.data) {
        return [[], 0];
    }
    const data = response.data[0];
    const total = response.data[1];
    const res = data.map((group: any) => {
        const users = group.users.map((user: any) => {
            return new User(
                user.uuid,
                user.name,
                user.email,
                user.role,
                user.avatarUrl,
                [],
                new Date(user.createdAt),
                new Date(user.updatedAt),
                new Date(user.deletedAt),
            );
        });
        const project_access = group.project_accesses.map((access: any) => {
            const project = new Project(
                access.project.uuid,
                access.project.name,
                access.project.description,
                [],
                undefined,
                undefined,
                undefined,
                new Date(access.project.createdAt),
                new Date(access.project.updatedAt),
                new Date(access.project.deletedAt),
            );
            return new ProjectAccess(
                access.uuid,
                access.rights,
                undefined,
                project,
                new Date(access.createdAt),
                new Date(access.updatedAt),
                new Date(access.deletedAt),
            );
        });
        return new AccessGroup(
            group.uuid,
            group.name,
            users,
            project_access,
            [],
            group.personal,
            group.inheriting,
            group.creator,
            new Date(group.createdAt),
            new Date(group.updatedAt),
            new Date(group.deletedAt),
        );
    });
    return [res, total];
};

export const getAccessGroup = async (uuid: string): Promise<AccessGroup> => {
    const response = await axios.get(`/access/one`, { params: { uuid } });
    const group = response.data;
    const users = group.users.map((user: any) => {
        return new User(
            user.uuid,
            user.name,
            user.email,
            user.role,
            user.avatarUrl,
            [],
            new Date(user.createdAt),
            new Date(user.updatedAt),
            new Date(user.deletedAt),
        );
    });
    const project_access = group.project_accesses.map((access: any) => {
        const creator = new User(
            access.project.creator.uuid,
            access.project.creator.name,
            access.project.creator.email,
            access.project.creator.role,
            access.project.creator.avatarUrl,
            [],
            new Date(access.project.creator.createdAt),
            new Date(access.project.creator.updatedAt),
            new Date(access.project.creator.deletedAt),
        );
        const project = new Project(
            access.project.uuid,
            access.project.name,
            access.project.description,
            [],
            creator,
            undefined,
            undefined,
            new Date(access.project.createdAt),
            new Date(access.project.updatedAt),
            new Date(access.project.deletedAt),
        );
        return new ProjectAccess(
            access.uuid,
            access.rights,
            undefined,
            project,
            new Date(access.createdAt),
            new Date(access.updatedAt),
            new Date(access.deletedAt),
        );
    });
    return new AccessGroup(
        group.uuid,
        group.name,
        users,
        project_access,
        [],
        group.personal,
        group.inheriting,
        group.creator,
        new Date(group.createdAt),
        new Date(group.updatedAt),
        new Date(group.deletedAt),
    );
};
