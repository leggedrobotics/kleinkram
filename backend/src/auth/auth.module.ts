import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { AuthController } from './auth.controller';
import { UserService } from '../user/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import User from '../user/entities/user.entity';
import env from '../env';
import { JwtStrategy } from './jwt.strategy';
import {
    AdminOnlyGuard,
    LoggedInUserGuard,
    TokenOrUserGuard,
} from './roles.guard';
import Apikey from './entities/apikey.entity';
import AccessGroup from './entities/accessgroup.entity';
import Account from './entities/account.entity';
import Project from '../project/entities/project.entity';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';
import Mission from '../mission/entities/mission.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Apikey,
            User,
            AccessGroup,
            Account,
            Project,
            Mission,
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
        GoogleStrategy,
        UserService,
        ProjectGuardService,
        MissionGuardService,
        JwtStrategy,
        AdminOnlyGuard,
        LoggedInUserGuard,
        TokenOrUserGuard,
    ],
    controllers: [AuthController],
    exports: [AdminOnlyGuard, LoggedInUserGuard, TokenOrUserGuard],
})
export class AuthModule {}
