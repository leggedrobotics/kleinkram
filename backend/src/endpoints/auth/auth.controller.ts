import { OutputDto } from '@/decorators';
import {
    ACCESS_TOKEN_LIFETIME,
    AccessTokenPayload,
    describeBrowser,
    InvalidSessionError,
    isSessionRefreshToken,
    SessionService,
} from '@/services/session.service';
import { UserService } from '@/services/user.service';
import { AvailableProvidersDto } from '@kleinkram/api-dto';
import { SessionEntity } from '@kleinkram/backend-common/entities/auth/session.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { CookieNames, Providers, SessionKind } from '@kleinkram/shared';
import {
    Controller,
    Get,
    MethodNotAllowedException,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { InvalidJwtTokenException } from './jwt.strategy';
import { UserOnly } from './roles.decorator';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly sessionService: SessionService,
        private readonly jwtService: JwtService,
        private userService: UserService,
    ) {}

    @Get('available-providers')
    @OutputDto(null)
    getAvailableProviders(): AvailableProvidersDto {
        return {
            google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
            github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
            fakeOauth: env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT,
        };
    }

    @Get('github')
    @UseGuards(AuthGuard('github'))
    async githubAuth(): Promise<void> {
        // Initiates the GitHub OAuth flow
        // OAuth is handled by the AuthGuard
    }

    @Get('fake-oauth')
    @UseGuards(AuthGuard(Providers.FakeOAuth))
    async fakeOAuth(): Promise<void> {
        // Initiates the GitHub OAuth flow
        // OAuth is handled by the AuthGuard
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(): Promise<void> {
        // Initiates the Google OAuth flow
        // OAuth is handled by the AuthGuard
    }

    @Get('github/callback')
    @UseGuards(AuthGuard('github'))
    @OutputDto(null)
    async githubAuthCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        @Req() request: any,
        @Res() response: Response,
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await this.handleAuthRedirect(request, response);
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @OutputDto(null)
    async googleAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        await this.handleAuthRedirect(request, response);
    }

    @Get('fake-oauth/callback')
    @UseGuards(AuthGuard(Providers.FakeOAuth))
    @OutputDto(null)
    async fakeOAuthAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        if (!env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT)
            throw new MethodNotAllowedException();
        await this.handleAuthRedirect(request, response);
    }

    private async handleAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const user = request.user as UserEntity;
        const state = request.query.state;
        // logins started by the CLI pass a `cli…` state (local callback
        // port, token page, fake-oauth test login)
        const isCli = typeof state === 'string' && state.startsWith('cli');
        const { tokens: token, session } = await this.sessionService.create(
            user,
            isCli
                ? { kind: SessionKind.CLI, name: 'klein (browser login)' }
                : {
                      kind: SessionKind.WEB,
                      ...describeBrowser(request.headers['user-agent']),
                  },
        );

        if (state === 'cli') {
            response.redirect(
                `http://localhost:8000/cli/callback?${CookieNames.AUTH_TOKEN}=${token[CookieNames.AUTH_TOKEN]}&${CookieNames.REFRESH_TOKEN}=${token[CookieNames.REFRESH_TOKEN]}`,
            );
            return;
        }

        if (typeof state === 'string' && state.startsWith('cli-port-')) {
            const portString = state.replace('cli-port-', '');
            const port = Number.parseInt(portString, 10);
            if (!Number.isNaN(port) && port >= 1 && port <= 65_535) {
                response.redirect(
                    `http://localhost:${String(port)}/cli/callback?${CookieNames.AUTH_TOKEN}=${token[CookieNames.AUTH_TOKEN]}&${CookieNames.REFRESH_TOKEN}=${token[CookieNames.REFRESH_TOKEN]}`,
                );
                return;
            }
        }

        if (state === 'cli-no-redirect') {
            const authToken = token[CookieNames.AUTH_TOKEN];
            const refreshToken = token[CookieNames.REFRESH_TOKEN];
            response.status(200).send(`
        <html>
        <head>
            <title>Authentication Successful</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
                .token { background-color: #f4f4f4; padding: 10px; border: 1px solid #ddd; word-wrap: break-word; }
                button { cursor: pointer; margin: 10px 0; padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; }
                button:hover { background-color: #45a049; }
                h1 { color: #4CAF50; }
                h2 { color: #333; }
            </style>
        </head>
        <body>
            <h1>Authentication Successful</h1>
            <p>Please copy your tokens from below and paste them back into your application.</p>

            <h2>Authentication Token</h2>
            <div class="token" id="authToken">${authToken}</div>
            <button onclick="copyToClipboard('authToken')">Copy Authentication Token</button>

            <h2>Refresh Token</h2>
            <div class="token" id="refreshToken">${refreshToken}</div>
            <button onclick="copyToClipboard('refreshToken')">Copy Refresh Token</button>

            <script>
                function copyToClipboard(elementId) {
                    var copyText = document.getElementById(elementId);
                    var textArea = document.createElement('textarea');
                    textArea.value = copyText.textContent;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('Copy');
                    textArea.remove();
                }
            </script>
        </body>
        </html>
            `);
            return;
        }

        setAuthCookie(response, token[CookieNames.AUTH_TOKEN]);
        setRefreshCookie(response, token[CookieNames.REFRESH_TOKEN], session);
        response.redirect(`${env.FRONTEND_URL}/landing`);
    }

    @Get('validate-token')
    @UserOnly()
    @OutputDto(null)
    validateToken(@Res() response: Response): void {
        // If we reach here, the token is valid
        response.status(200).json({ message: 'Token is valid' });
    }

    @Post('refresh-token')
    @OutputDto(null)
    async refreshToken(@Req() request: Request, @Res() response: Response) {
        const refreshToken: unknown =
            request.cookies[CookieNames.REFRESH_TOKEN];
        if (typeof refreshToken !== 'string' || refreshToken === '') {
            return response
                .status(401)
                .json({ message: 'Refresh token not found' });
        }

        if (isSessionRefreshToken(refreshToken)) {
            const clientVersion = request.headers['kleinkram-client-version'];
            try {
                const result = await this.sessionService.refresh(
                    refreshToken,
                    typeof clientVersion === 'string'
                        ? clientVersion
                        : undefined,
                );
                setAuthCookie(response, result.tokens[CookieNames.AUTH_TOKEN]);
                if (result.rotated) {
                    setRefreshCookie(
                        response,
                        result.tokens[CookieNames.REFRESH_TOKEN],
                        result.session,
                    );
                }
                return response
                    .status(200)
                    .json({ message: 'Token refreshed' });
            } catch (error) {
                if (!(error instanceof InvalidSessionError)) throw error;
                clearAuthCookies(response);
                return response
                    .status(401)
                    .json({ message: 'Session ended, please log in again' });
            }
        }

        // refresh tokens from before sessions existed: they keep working
        // until they expire (7 days), without becoming revocable
        try {
            const payload =
                this.jwtService.verify<AccessTokenPayload>(refreshToken);

            const user = await this.userService.findOneByUUID(
                payload.uuid,
                { uuid: true, email: true, role: true },
                {},
            );

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!user) {
                return response
                    .status(401)
                    .json({ message: 'Invalid refresh token' });
            }

            const newAuthToken = this.jwtService.sign(
                { uuid: user.uuid },
                { expiresIn: ACCESS_TOKEN_LIFETIME },
            );
            setAuthCookie(response, newAuthToken);
            return response.status(200).json({ message: 'Token refreshed' });
        } catch {
            throw InvalidJwtTokenException;
        }
    }

    /**
     * Ends the current session on the server (not only in this browser or
     * CLI) and clears the cookies.
     */
    @Post('logout')
    @OutputDto(null)
    async logout(
        @Req() request: Request,
        @Res() response: Response,
    ): Promise<void> {
        const refreshToken: unknown =
            request.cookies[CookieNames.REFRESH_TOKEN];

        const accessToken: unknown = request.cookies[CookieNames.AUTH_TOKEN];

        let revoked = false;
        if (
            typeof refreshToken === 'string' &&
            isSessionRefreshToken(refreshToken)
        ) {
            revoked =
                await this.sessionService.revokeByRefreshToken(refreshToken);
        }
        if (!revoked && typeof accessToken === 'string') {
            try {
                const payload = this.jwtService.verify<AccessTokenPayload>(
                    accessToken,
                    { ignoreExpiration: true },
                );
                if (payload.sid !== undefined) {
                    await this.sessionService.revoke(
                        payload.sid,
                        'logout',
                        payload.uuid,
                    );
                }
            } catch {
                // not a token of ours, nothing to end
            }
        }

        clearAuthCookies(response);
        response.status(200).json({ message: 'Logged out' });
    }
}

const COOKIE_BASE = {
    // browsers accept secure cookies on http://localhost, so this also
    // works in local development
    secure: true,
    sameSite: 'strict' as const,
};

function setAuthCookie(response: Response, token: string): void {
    response.cookie(CookieNames.AUTH_TOKEN, token, {
        ...COOKIE_BASE,
        httpOnly: false,
    });
}

function setRefreshCookie(
    response: Response,
    token: string,
    session: SessionEntity,
): void {
    response.cookie(CookieNames.REFRESH_TOKEN, token, {
        ...COOKIE_BASE,
        httpOnly: true,
        expires: session.expiresAt,
    });
}

function clearAuthCookies(response: Response): void {
    response.cookie(CookieNames.AUTH_TOKEN, '', {
        ...COOKIE_BASE,
        httpOnly: false,
        expires: new Date(0),
    });
    response.cookie(CookieNames.REFRESH_TOKEN, '', {
        ...COOKIE_BASE,
        httpOnly: true,
        expires: new Date(0),
    });
}
