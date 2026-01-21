import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { MissionEntity } from '../../entities/mission/mission.entity';
import { MissionAccessViewEntity } from '../../viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '../../viewEntities/project-access-view.entity';

@Injectable()
export class AccessControlService {
    constructor(
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
    ) {}

    async canAccessMission(
        user: { uuid: string; role: UserRole },
        mission: { uuid: string; project?: { uuid: string } },
        rights: AccessGroupRights,
    ): Promise<boolean> {
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        // Check if user has direct access to the mission
        const directAccess = await this.missionAccessView.findOne({
            where: {
                missionUuid: mission.uuid,
                userUuid: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });

        if (directAccess) {
            return true;
        }

        let projectUuid = mission.project?.uuid;
        if (!projectUuid) {
            // Need to fetch mission to get project uuid
            const missionWithProject = await this.missionRepository.findOne({
                where: { uuid: mission.uuid },
                relations: ['project'],
            });

            if (missionWithProject?.project) {
                projectUuid = missionWithProject.project.uuid;
            } else {
                return false;
            }
        }

        // Check if user has access via project
        const projectAccess = await this.projectAccessView.findOne({
            where: {
                projectUuid: projectUuid,
                userUuid: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });

        return !!projectAccess;
    }
}
