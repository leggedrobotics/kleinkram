import { AuthService } from '@/services/auth.service';
import {
    loginStateOptions,
    OAuthLoginStateService,
} from '@/services/oauth-login-state.service';
import env from '@kleinkram/backend-common/environment';
import { Providers } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import e from 'express';
import { Strategy as OAuth2Strategy, VerifyCallback } from 'passport-oauth2';
import logger from '../../logger';

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
    constructor(
        private authService: AuthService,
        oauthLoginState: OAuthLoginStateService,
    ) {
        super({
            // binds the login to this browser (state + PKCE), see
            // OAuthLoginStateService
            pkce: true,
            store: oauthLoginState.store,
            authorizationURL: 'http://localhost:8004/oauth/authorize',
            tokenURL: 'http://fake-oauth:5000/oauth/token',
            // no need to pass clientID and clientSecret as this is a fake OAuth provider
            // this is used for local development and testing purposes only
            clientID: 'some-random-string-it-does-not-matter',
            clientSecret: 'some-random-string-it-does-not-matter',
            callbackURL: `${env.BACKEND_URL}/auth/fake-oauth/callback`,
            scope: [],
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authenticate(request: e.Request, options?: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        options.state = loginStateOptions(request);
        // Pass the user parameter to the OAuth provider for auto-login
        if (request.query.user) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            options.user = request.query.user;
        }
        super.authenticate(request, options);
    }

    /** sends `user` on to fake-oauth, which then logs in without a page */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorizationParams(options: any): object {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        return options.user ? { user: options.user } : {};
    }

    async validate(
        accessToken: string,
        _refreshToken: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _profile: any,
        callback: VerifyCallback,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fetchedProfile = await fetchedProfileResponse.json();
        const user =
            await this.authService.validateAndCreateUserByFakeOAuth(
                fetchedProfile,
            );

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
