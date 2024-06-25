import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { AuthController } from './auth.controller';
import { UserService } from '../user/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AdminOnlyGuard, LoggedInUserGuard, TokenOrUserGuard } from './roles.guard';
import Apikey from '@common/entities/auth/apikey.entity';
import User from '@common/entities/user/user.entity';
import Account from '@common/entities/auth/account.entity';
import Project from '@common/entities/project/project.entity';
import Mission from '@common/entities/mission/mission.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import env from '@common/env';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';


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
export class AuthModule {
}
