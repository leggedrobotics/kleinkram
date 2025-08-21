import env from '@common/environment';
import { Providers } from '@common/frontend_shared/enum';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import e from 'express';
import {
    Strategy as OAuth2Strategy,
    StrategyOptions,
    VerifyCallback,
} from 'passport-oauth2';
import logger from '../../logger';
import { AuthService } from '../../services/auth.service';

/**
 *
 * A very basic OAuth2 strategy for local development and testing purposes.
 * Do NOT use this in production!
 *
 */
@Injectable()
export class FakeOauthStrategy extends PassportStrategy(
    OAuth2Strategy,
    Providers.FakeOAuth,
) {
    constructor(private authService: AuthService) {
        super({
            authorizationURL: 'http://localhost:8004/oauth/authorize',
            tokenURL: 'http://fake-oauth:5000/oauth/token',
            // no need to pass clientID and clientSecret as this is a fake OAuth provider
            // this is used for local development and testing purposes only
            clientID: 'some-random-string-it-does-not-matter',
            clientSecret: 'some-random-string-it-does-not-matter',
            callbackURL: `${env.ENDPOINT}/auth/fake-oauth/callback`,
            scope: [],
        } as StrategyOptions);
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
        // fetch profile from http://fake-oauth:5000/oauth/profile

        const fetchedProfileResponse = await fetch(
            'http://fake-oauth:5000/oauth/profile',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        const fetchedProfile = await fetchedProfileResponse.json();
        const user =
            await this.authService.validateAndCreateUserByFakeOAuth(
                fetchedProfile,
            );

        if (user) {
            logger.debug(`Login successful for ${user.uuid}`);
            callback(null, user);
            return;
        }

        callback(null);
        return;
    }
}
