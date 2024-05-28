import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from './auth.service';
import env from '../env';
import e from 'express';

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

    authenticate(req: e.Request, options?: any) {
        options.state = req.query.state;
        super.authenticate(req, options);
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: VerifyCallback,
    ): Promise<any> {
        const user =
            await this.authService.validateAndCreateUserByGoogle(profile);
        done(null, user);
    }
}
