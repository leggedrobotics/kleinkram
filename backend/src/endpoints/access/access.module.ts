import { AccessService } from '@/services/access.service';
import { UserService } from '@/services/user.service';
import {
    AccessGroupAuditService,
    AccessGroupEntity,
    AccessGroupEventEntity,
    ProjectEntity,
} from '@kleinkram/backend-common';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../user/user.module';
import { AccessController } from './access.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserEntity,
            AccessGroupEntity,
            AccessGroupEventEntity,
            GroupMembershipEntity,
            ProjectEntity,
            ProjectAccessEntity,
        ]),
        UserModule,
    ],
    providers: [AccessService, AccessGroupAuditService, UserService],
    controllers: [AccessController],
    exports: [AccessService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AccessModule {}
