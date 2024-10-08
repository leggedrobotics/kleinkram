import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CookieNames } from '@common/enum';
import env from '@common/env';
import { UserService } from '../user/user.service';

export class InvalidJwtTokenException extends Error {
    constructor() {
        super('Invalid JWT token');
    }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        private userService: UserService,
    ) {
        super({
            jwtFromRequest: (req: Request) => {
                let token = null;
                if (req && req.cookies) {
                    token = req.cookies[CookieNames.AUTH_TOKEN];
                }
                return token;
            },
            ignoreExpiration: false,
            secretOrKey: env.JWT_SECRET,
        });
    }

    async validate(payload: any) {
        if (payload.uuid) {
            try {
                const user = await this.userService.findOneByUUID(payload.uuid);
                return { user };
            } catch (e) {
                throw InvalidJwtTokenException;
            }
        }
        return {
            uuid: payload.uuid,
        };
    }
}
