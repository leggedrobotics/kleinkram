import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AdminOnlyGuard, LoggedInUserGuard } from './roles.guard';

import Account from '@common/entities/auth/account.entity';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import env from '@common/env';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';
import Tag from '@common/entities/tag/tag.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import MissionAccess from '@common/entities/auth/mission_access.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import { AccessService } from './access.service';
import { AccessController } from './access.controller';
import FileEntity from '@common/entities/file/file.entity';
import { AuthGuardService } from './authGuard.service';
import GroupMembership from '@common/entities/auth/group_membership.entity';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            AccessGroup,
            Account,
            Project,
            Mission,
            Tag,
            ProjectAccess,
            MissionAccess,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            FileEntity,
            GroupMembership,
        ]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            useFactory: async () => ({
                secret: env.JWT_SECRET,
                signOptions: { expiresIn: '60m' },
            }),
        }),
    ],
    providers: [
        AuthService,
        AccessService,
        GoogleStrategy,
        ProjectGuardService,
        MissionGuardService,
        AuthGuardService,
        JwtStrategy,
        AdminOnlyGuard,
        LoggedInUserGuard,
    ],
    controllers: [AuthController, AccessController],
    exports: [
        AdminOnlyGuard,
        LoggedInUserGuard,
        ProjectGuardService,
        MissionGuardService,
        TypeOrmModule.forFeature([
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
        ]),
    ],
})
export class AuthModule {}
