import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '../../services/auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AdminOnlyGuard, LoggedInUserGuard } from './roles.guard';

import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { MissionAccessEntity } from '@kleinkram/backend-common/entities/auth/mission-access.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import env from '@kleinkram/backend-common/environment';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { AccessService } from '../../services/access.service';
import { ProjectGuardService } from '../../services/project-guard.service';
import { AccessController } from './access.controller';
import { AuthGuardService } from './auth-guard.service';
import { FakeOauthStrategy } from './fake-oauth.strategy';
import { GitHubStrategy } from './github.strategy';
import { MissionGuardService } from './mission-guard.service';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            AccessGroupEntity,
            AccountEntity,
            ProjectEntity,
            MissionEntity,
            MetadataEntity,
            ProjectAccessEntity,
            MissionAccessEntity,
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
            FileEntity,
            GroupMembershipEntity,
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
        GitHubStrategy,
        FakeOauthStrategy,
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
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
