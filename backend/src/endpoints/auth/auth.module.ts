import { AuthService } from '@/services/auth.service';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './google.strategy';
import { AdminOnlyGuard, LoggedInUserGuard } from './guards';
import { JwtStrategy } from './jwt.strategy';

import { ProjectGuardService } from '@/services/project-guard.service';
import {
    AccessGroupEntity,
    AccountEntity,
    AffiliationGroupService,
    GroupMembershipEntity,
    MissionAccessEntity,
    ProjectAccessEntity,
} from '@kleinkram/backend-common';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import env from '@kleinkram/backend-common/environment';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';

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
        AffiliationGroupService,

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
    controllers: [AuthController],
    exports: [
        AdminOnlyGuard,
        LoggedInUserGuard,
        ProjectGuardService,
        MissionGuardService,
        AuthGuardService,
        TypeOrmModule.forFeature([
            ProjectAccessViewEntity,
            MissionAccessViewEntity,
        ]),
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AuthModule {}
