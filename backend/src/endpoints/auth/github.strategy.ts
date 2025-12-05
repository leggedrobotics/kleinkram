import env from '@kleinkram/backend-common/environment';
import { Providers } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import e from 'express';
import { Strategy } from 'passport-github2';
import logger from '../../logger';
import { AuthService } from '../../services/auth.service';
import { AuthFlowException } from '../../types/auth-flow-exception';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
    constructor(private authService: AuthService) {
        super({
            clientID: env.GITHUB_CLIENT_ID ?? 'dummy',
            clientSecret: env.GITHUB_CLIENT_SECRET ?? 'dummy',
            callbackURL: `${env.ENDPOINT}/auth/github/callback`,
            scope: ['user:email', 'user:profile'],
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate(request: e.Request, options?: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        options.state = request.query.state;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super.authenticate(request, options);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        profile: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callback: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { provider } = profile;

        // currently only github is supported
        if (provider !== Providers.GITHUB) {
            logger.error('Invalid provider, expected github but got', provider);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(new AuthFlowException('Invalid provider!'));
            return;
        }

        const user =
            await this.authService.validateAndCreateUserByGitHub(profile);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            callback(null, user);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null);
        return;
    }
}
