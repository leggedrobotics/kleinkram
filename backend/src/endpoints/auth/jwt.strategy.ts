import env from '@kleinkram/backend-common/environment';
import { CookieNames } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
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
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (request.cookies) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    token = request.cookies[CookieNames.AUTH_TOKEN];
                }
                return token as string | null;
            },
            ignoreExpiration: false,
            secretOrKey: env.JWT_SECRET,
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async validate(payload: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (payload.uuid) {
            try {
                const user = await this.userService.findOneByUUID(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    payload.uuid,
                    { uuid: true, role: true, name: true },
                    {},
                );
                return { user };
            } catch {
                throw InvalidJwtTokenException;
            }
        }
        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            uuid: payload.uuid,
        };
    }
}
