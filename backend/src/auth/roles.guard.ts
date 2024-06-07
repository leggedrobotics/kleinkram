import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
    Type,
    mixin,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CookieNames, UserRole } from '../enum';
import { InjectRepository } from '@nestjs/typeorm';
import User from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import Apikey from './entities/apikey.entity';
import Account from './entities/account.entity';

@Injectable()
export class PublicGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        return true; // Always allow access
    }
}

@Injectable()
export class TokenOrUserGuard extends AuthGuard('jwt') {
    constructor(
        @InjectRepository(Apikey) private tokenRepository: Repository<Apikey>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        if (request.cookies['cli_token']) {
            // const token = await this.tokenRepository.find();
            const token = await this.tokenRepository.findOne({
                where: {
                    apikey: request.cookies[CookieNames.CLI_KEY],
                },
                relations: ['mission'],
            });
            if (request.query.uuid != token.mission.uuid) {
                throw new ForbiddenException('Invalid token');
            }
        } else {
            await super.canActivate(context);
        }
        return true;
    }
}

@Injectable()
export class LoggedInUserGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);
        return true;
    }
}

@Injectable()
export class AdminOnlyGuard extends AuthGuard('jwt') {
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        console.log('canActivate -> user', user);
        if (!user) {
            throw new UnauthorizedException('User not logged in');
        }

        const userFromDb = await this.accountRepository.findOne({
            where: { oauthID: user.userId },
            relations: ['user'],
        });

        if (userFromDb.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('User is not an admin');
        }

        return true;
    }
}
