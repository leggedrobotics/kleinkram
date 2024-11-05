import axios from 'src/api/axios';
import { AccessGroup } from 'src/types/AccessGroup';
import { User } from 'src/types/User';
import { ProjectAccess } from 'src/types/ProjectAccess';
import { Project } from 'src/types/Project';
import { AccessGroupUser } from 'src/types/AccessGroupUser';

export const canAddAccessGroup = async (
    projectUuid: string,
): Promise<boolean> => {
    if (!projectUuid) {
        return false;
    }
    const response = await axios.get('/access/canAddAccessGroupToProject', {
        params: { uuid: projectUuid },
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
    const response = await axios.get('/access/filtered', {
        params,
    });
    if (!response.data) {
        return [[], 0];
    }
    const data = response.data[0];
    const total = response.data[1];
    const res = data.map((group: any) => {
        const agus = group.accessGroupUsers.map((agu: any) => {
            const user = new User(
                agu.user.uuid,
                agu.user.name,
                agu.user.email,
                agu.user.role,
                agu.user.avatarUrl,
                [],
                [],
                new Date(agu.user.createdAt),
                new Date(agu.user.updatedAt),
            );
            return new AccessGroupUser(
                agu.uuid,
                new Date(agu.createdAt),
                new Date(agu.updatedAt),
                user,
                null,
                agu.expirationDate ? new Date(agu.expirationDate) : null,
            );
        });
        const projectAccess = group.project_accesses.map((access: any) => {
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
            );
            return new ProjectAccess(
                access.uuid,
                access.rights,
                undefined,
                project,
                new Date(access.createdAt),
                new Date(access.updatedAt),
            );
        });
        return new AccessGroup(
            group.uuid,
            group.name,
            agus,
            projectAccess,
            [],
            group.personal,
            group.inheriting,
            group.creator,
            new Date(group.createdAt),
            new Date(group.updatedAt),
        );
    });
    return [res, total];
};

export const getAccessGroup = async (uuid: string): Promise<AccessGroup> => {
    const response = await axios.get(`/access/one`, { params: { uuid } });
    const group = response.data;
    const agus = group.accessGroupUsers.map((agu: any) => {
        const user = new User(
            agu.user.uuid,
            agu.user.name,
            agu.user.email,
            agu.user.role,
            agu.user.avatarUrl,
            [],
            [],
            new Date(agu.user.createdAt),
            new Date(agu.user.updatedAt),
        );
        return new AccessGroupUser(
            agu.uuid,
            new Date(agu.createdAt),
            new Date(agu.updatedAt),
            user,
            null,
            agu.expirationDate ? new Date(agu.expirationDate) : null,
        );
    });
    const projectAccess = group.project_accesses.map((access: any) => {
        const creator = new User(
            access.project.creator.uuid,
            access.project.creator.name,
            access.project.creator.email,
            access.project.creator.role,
            access.project.creator.avatarUrl,
            [],
            [],
            new Date(access.project.creator.createdAt),
            new Date(access.project.creator.updatedAt),
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
        );
        return new ProjectAccess(
            access.uuid,
            access.rights,
            undefined,
            project,
            new Date(access.createdAt),
            new Date(access.updatedAt),
        );
    });
    return new AccessGroup(
        group.uuid,
        group.name,
        agus,
        projectAccess,
        [],
        group.personal,
        group.inheriting,
        group.creator,
        new Date(group.createdAt),
        new Date(group.updatedAt),
    );
};

export const getProjectAccess = async (
    projectUUID: string,
    projectAccessUUID: string,
): Promise<ProjectAccess> => {
    const response = await axios.get(`/access/projectAccess`, {
        params: { uuid: projectUUID, projectAccessUUID },
    });
    const access = response.data;
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
    );
    return new ProjectAccess(
        access.uuid,
        access.rights,
        undefined,
        project,
        new Date(access.createdAt),
        new Date(access.updatedAt),
    );
};
