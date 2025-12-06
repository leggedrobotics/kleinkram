import env from '@kleinkram/backend-common/environment';
import { Providers } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import e from 'express';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import logger from '../../logger';
import { AuthService } from '../../services/auth.service';
import { AuthFlowException } from '../../types/auth-flow-exception';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private authService: AuthService) {
        super({
            clientID: env.GOOGLE_CLIENT_ID ?? 'dummy',
            clientSecret: env.GOOGLE_CLIENT_SECRET ?? 'dummy',
            callbackURL: `${env.BACKEND_URL}/auth/google/callback`,
            scope: ['email', 'profile'],
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate(request: e.Request, options?: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        options.state = request.query.state;
        super.authenticate(request, options);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile: any,
        callback: VerifyCallback,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { provider } = profile;

        // currently only google is supported
        if (provider !== Providers.GOOGLE) {
            logger.error('Invalid provider, expected google but got', provider);
            callback(new AuthFlowException('Invalid provider!'));
            return;
        }

        const user =
            await this.authService.validateAndCreateUserByGoogle(profile);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            callback(null, user);
            return;
        }

        callback(null);
        return;
    }
}
