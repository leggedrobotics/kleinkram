import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectGuardService } from './projectGuard.service';

@Injectable()
export class MissionGuardService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        private projectGuardService: ProjectGuardService,
    ) {}
    async canAccessMission(
        userUUID: string,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOne({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                userUUID,
                mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        const res = await this.missionRepository
            .createQueryBuilder('mission')
            .leftJoin('mission.accessGroups', 'accessGroups')
            .leftJoin('accessGroups.users', 'users')
            .where('mission.uuid = :uuid', { uuid: missionUUID })
            .andWhere('users.uuid = :user', { user: user.uuid })
            .andWhere('accessGroups.rights >= :rights', {
                rights,
            })
            .getMany();

        return res.length > 0;
    }

    async canAccessMissionByName(
        userUUID: string,
        missionName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const mission = await this.missionRepository.findOne({
            where: { name: missionName },
        });
        if (!mission) {
            return true;
        }
        return this.canAccessMission(userUUID, mission.uuid, rights);
    }
}
