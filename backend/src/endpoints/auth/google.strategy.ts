import env from '@common/environment';
import { Providers } from '@common/frontend_shared/enum';
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
            clientID: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${env.ENDPOINT}/auth/google/callback`,
            scope: ['email', 'profile'],
        });
    }

    authenticate(request: e.Request, options?: any) {
        options.state = request.query['state'];
        super.authenticate(request, options);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        callback: VerifyCallback,
    ): Promise<any> {
        const { provider } = profile;

        // currently only google is supported
        if (provider !== Providers.GOOGLE) {
            logger.error('Invalid provider, expected google but got', provider);
            callback(new AuthFlowException('Invalid provider!'));
            return;
        }

        const user =
            await this.authService.validateAndCreateUserByGoogle(profile);

        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            callback(null, user);
            return;
        }

        callback(null);
        return;
    }
}
