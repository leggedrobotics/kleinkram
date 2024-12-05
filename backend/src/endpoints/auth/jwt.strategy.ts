import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { CookieNames } from '@common/frontend_shared/enum';
import env from '@common/env';
import { UserService } from '../../services/user.service';

export class InvalidJwtTokenException extends Error {
    constructor() {
        super('Invalid JWT token');
    }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private userService: UserService) {
        super({
            jwtFromRequest: (request: Request) => {
                let token = null;
                if (request.cookies) {
                    token = request.cookies[CookieNames.AUTH_TOKEN];
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
                const user = await this.userService.findOneByUUID(
                    payload.uuid,
                    {},
                    {},
                );
                return { user };
            } catch {
                throw InvalidJwtTokenException;
            }
        }
        return {
            uuid: payload.uuid,
        };
    }
}
