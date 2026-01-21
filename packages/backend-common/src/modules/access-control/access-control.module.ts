import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { MissionAccessViewEntity } from '@backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@backend-common/viewEntities/project-access-view.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlService } from './access-control.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            MissionEntity,
            MissionAccessViewEntity,
            ProjectAccessViewEntity,
        ]),
    ],
    providers: [AccessControlService],
    exports: [AccessControlService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AccessControlModule {}
