import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import Account from './entities/account.entity';
import { Repository } from 'typeorm';
import User from '../user/entities/user.entity';
import AccessGroup from './entities/accessgroup.entity';
import Project from '../project/entities/project.entity';
import { AccessGroupRights, UserRole } from '../enum';

@Injectable()
export class GuardService {
    constructor(
        private userService: UserService,
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
    ) {}

    async canAccessProject(
        oathID: string,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const account = await this.accountRepository.findOne({
            where: { oauthID: oathID },
            relations: ['user'],
        });
        if (!account) {
            return false;
        }
        if (account.user.role === UserRole.ADMIN) {
            return true;
        }
        const res = await this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.accessGroups', 'accessGroups')
            .leftJoin('accessGroups.users', 'users')
            .where('project.uuid = :uuid', { uuid: projectUUID })
            .andWhere('users.uuid = :user', { user: account.user.uuid })
            .andWhere('accessGroups.rights >= :rights', {
                rights,
            })
            .getMany();
        console.log(res);
        return res.length > 0;
    }

    async canAccessProjectByName(
        oathID: string,
        projectName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const project = await this.projectRepository.findOne({
            where: { name: projectName },
        });
        if (!project) {
            return false;
        }
        return this.canAccessProject(oathID, project.uuid, rights);
    }

    async canCreateProject(oathID: string) {
        const account = await this.accountRepository.findOne({
            where: { oauthID: oathID },
            relations: ['user'],
        });
        if (!account) {
            return false;
        }
        if (account.user.role === UserRole.ADMIN) {
            return true;
        }

        const canCreate = await this.accessGroupRepository
            .createQueryBuilder('accessGroup')
            .leftJoin('accessGroups.users', 'users')
            .where('accessGroup.rights >= :rights', {
                rights: AccessGroupRights.WRITE,
            })
            .andWhere('users.uuid = :user', { user: account.user.uuid })
            .andWhere('accessGroup.personal = FALSE')
            .getCount();
        return canCreate > 0;
    }
}
