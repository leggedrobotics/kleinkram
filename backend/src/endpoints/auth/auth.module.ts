import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from '../../services/auth.service';
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
import Tag from '@common/entities/tag/tag.entity';
import ProjectAccess from '@common/entities/auth/project-access.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import MissionAccess from '@common/entities/auth/mission-access.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/mission-access-view.entity';
import { AccessService } from '../../services/access.service';
import { AccessController } from './access.controller';
import FileEntity from '@common/entities/file/file.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import { ProjectGuardService } from '../../services/project-guard.service';
import { MissionGuardService } from './mission-guard.service';
import { AuthGuardService } from './auth-guard.service';

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
            useFactory: () => ({
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
