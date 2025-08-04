import env from '@common/environment';
import { Providers } from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import e from 'express';
import { Strategy, VerifyCallback } from 'passport-github2';
import logger from '../../logger';
import { AuthFlowException } from '../../routing/filters/auth-flow-exception';
import { AuthService } from '../../services/auth.service';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private authService: AuthService) {
        super({
            clientID: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            callbackURL: `${env.ENDPOINT}/auth/github/callback`,
            scope: ['user:email', 'user:profile'],
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

        // currently only github is supported
        if (provider !== Providers.GITHUB) {
            logger.error('Invalid provider, expected github but got', provider);
            callback(new AuthFlowException('Invalid provider!'));
            return;
        }

        const user = await this.authService
            .validateAndCreateUserByGitHub(profile)
            .catch((error: unknown) => {
                logger.error(
                    'Error while validating and creating user by github',
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
