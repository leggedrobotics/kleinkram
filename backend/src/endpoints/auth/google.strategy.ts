import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../../services/auth.service';
import e from 'express';
import logger from '../../logger';
import { AuthFlowException } from '../../routing/filters/auth-flow-exception';
import env from '@common/environment';
import { Providers } from '@common/frontend_shared/enum';

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

        const user = await this.authService
            .validateAndCreateUserByGoogle(profile)
            .catch((error: unknown) => {
                logger.error(
                    'Error while validating and creating user by google',
                    error,
                );
                callback(error);
                return;
            });

        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            callback(null, user);
            return;
        }

        callback(null);
        return;
    }
}
