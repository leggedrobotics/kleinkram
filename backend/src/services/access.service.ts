import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    AccessGroupAuditLogsDto,
    AccessGroupDto,
    AccessGroupsDto,
    GroupMembershipDto,
    ProjectAccessDto,
    ProjectAccessListDto,
    ProjectDto,
} from '@kleinkram/api-dto';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { AccessGroupRights, AccessGroupType } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { AccessModificationService } from './access-modification.service';
import { AccessQueryService } from './access-query.service';

@Injectable()
export class AccessService {
    constructor(
        private readonly accessQueryService: AccessQueryService,
        private readonly accessModificationService: AccessModificationService,
    ) {}

    async getAccessGroup(
        uuid: string,
        userUuid: string,
    ): Promise<AccessGroupDto> {
        return this.accessQueryService.getAccessGroup(uuid, userUuid);
    }

    async createAccessGroup(
        name: string,
        auth: AuthHeader,
    ): Promise<AccessGroupEntity> {
        return this.accessModificationService.createAccessGroup(name, auth);
    }

    async hasProjectRights(
        projectUUID: string,
        auth: AuthHeader,
        rights: AccessGroupRights = AccessGroupRights.WRITE,
    ): Promise<boolean> {
        return this.accessQueryService.hasProjectRights(
            projectUUID,
            auth,
            rights,
        );
    }

    async addUserToProject(
        projectUUID: string,
        userUUID: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<ProjectEntity> {
        return this.accessModificationService.addUserToProject(
            projectUUID,
            userUUID,
            rights,
            auth,
        );
    }

    async addUserToAccessGroup(
        accessGroupUUID: string,
        userUUID: string,
        canEditGroup = false,
        expireDate?: Date | 'never',
        auth?: AuthHeader,
    ): Promise<AccessGroupEntity> {
        return this.accessModificationService.addUserToAccessGroup(
            accessGroupUUID,
            userUUID,
            canEditGroup,
            expireDate,
            auth,
        );
    }

    async removeUsersFromAccessGroup(
        accessGroupUUID: string,
        userUuids: string[],
        auth?: AuthHeader,
    ): Promise<AccessGroupEntity> {
        return this.accessModificationService.removeUsersFromAccessGroup(
            accessGroupUUID,
            userUuids,
            auth,
        );
    }

    async searchAccessGroup(
        search: string,
        type: AccessGroupType | undefined,
        skip: number,
        take: number,
    ): Promise<AccessGroupsDto> {
        return this.accessQueryService.searchAccessGroup(
            search,
            type,
            skip,
            take,
        );
    }

    async addAccessGroupToProject(
        projectUUID: string,
        accessGroupUUID: string,
        rights: AccessGroupRights,
        auth: AuthHeader,
    ): Promise<ProjectDto> {
        return this.accessModificationService.addAccessGroupToProject(
            projectUUID,
            accessGroupUUID,
            rights,
            auth,
        );
    }

    async removeAccessGroupFromProject(
        projectUUID: string,
        accessGroupUUID: string,
        auth: AuthHeader,
    ) {
        return this.accessModificationService.removeAccessGroupFromProject(
            projectUUID,
            accessGroupUUID,
            auth,
        );
    }

    async deleteAccessGroup(uuid: string): Promise<void> {
        return this.accessModificationService.deleteAccessGroup(uuid);
    }

    async getProjectAccesses(
        projectUUID: string,
    ): Promise<ProjectAccessListDto> {
        return this.accessQueryService.getProjectAccesses(projectUUID);
    }

    async updateProjectAccess(
        projectUuid: string,
        newProjectAccess: ProjectAccessDto[],
        authHeader: AuthHeader,
    ): Promise<ProjectAccessListDto> {
        return this.accessModificationService.updateProjectAccess(
            projectUuid,
            newProjectAccess,
            authHeader,
        );
    }

    async setExpireDate(
        uuid: string,
        userUuid: string,
        expireDate: Date | 'never',
        auth?: AuthHeader,
    ): Promise<GroupMembershipDto> {
        return this.accessModificationService.setExpireDate(
            uuid,
            userUuid,
            expireDate,
            auth,
        );
    }

    async setCanEditGroup(
        uuid: string,
        userUuid: string,
        canEditGroup: boolean,
        auth?: AuthHeader,
    ): Promise<GroupMembershipDto> {
        return this.accessModificationService.setCanEditGroup(
            uuid,
            userUuid,
            canEditGroup,
            auth,
        );
    }

    async getAuditLogs(uuid: string): Promise<AccessGroupAuditLogsDto> {
        return this.accessQueryService.getAuditLogs(uuid);
    }
}
