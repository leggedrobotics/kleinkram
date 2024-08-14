import { Global, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { AuthController } from './auth.controller';
import { UserService } from '../user/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import {
    AdminOnlyGuard,
    LoggedInUserGuard,
    TokenOrUserGuard,
} from './roles.guard';
import Apikey from '@common/entities/auth/apikey.entity';
import User from '@common/entities/user/user.entity';
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

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Apikey,
            User,
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
        UserService,
        ProjectGuardService,
        MissionGuardService,
        JwtStrategy,
        AdminOnlyGuard,
        LoggedInUserGuard,
        TokenOrUserGuard,
    ],
    controllers: [AuthController, AccessController],
    exports: [AdminOnlyGuard, LoggedInUserGuard, TokenOrUserGuard],
})
export class AuthModule {}
