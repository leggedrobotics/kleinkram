import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';
import User from '@common/entities/user/user.entity';
import Action from '@common/entities/action/action.entity';
import { AccessGroupRights, UserRole } from '@common/enum';

@Injectable()
export class ActionGuardService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {}

    async canAccessAction(
        userUUID: string,
        actionUUID: string,
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
        const action = await this.actionRepository.findOne({
            where: { uuid: actionUUID },
            relations: ['mission', 'mission.project'],
        });
        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                userUUID,
                action.mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            userUUID,
            action.mission.uuid,
            rights,
        );
    }
}
