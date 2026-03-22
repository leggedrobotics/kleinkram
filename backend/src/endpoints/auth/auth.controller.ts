import { OutputDto } from '@/decorators';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { AvailableProvidersDto } from '@kleinkram/api-dto';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { CookieNames, Providers } from '@kleinkram/shared';
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
        private authService: AuthService,
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
    @OutputDto(null) // TODO: type API response
    // eslint-disable-next-line @typescript-eslint/require-await
    async githubAuthCallback(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        @Req() request: any,
        @Res() response: Response,
    ): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.handleAuthRedirect(request, response);
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @OutputDto(null) // TODO: type API response
    googleAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): void {
        this.handleAuthRedirect(request, response);
    }

    @Get('fake-oauth/callback')
    @UseGuards(AuthGuard(Providers.FakeOAuth))
    @OutputDto(null) // TODO: type API response
    fakeOAuthAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): void {
        if (!env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT)
            throw new MethodNotAllowedException();
        this.handleAuthRedirect(request, response);
    }

    private handleAuthRedirect(
        @Req() request: Request,
        @Res() response: Response,
    ): void {
        const user = request.user;
        const token = this.authService.login(user as UserEntity);
        const state = request.query.state;

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

        response.cookie(CookieNames.AUTH_TOKEN, token[CookieNames.AUTH_TOKEN], {
            httpOnly: false,
            secure: env.DEV,
            sameSite: 'strict',
        });
        response.cookie(
            CookieNames.REFRESH_TOKEN,
            token[CookieNames.REFRESH_TOKEN],
            {
                httpOnly: true,
                secure: env.DEV,
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            },
        );
        response.redirect(`${env.FRONTEND_URL}/landing`);
    }

    @Get('validate-token')
    @UserOnly()
    @OutputDto(null) // TODO: type API response
    validateToken(@Res() response: Response): void {
        // If we reach here, the token is valid
        response.status(200).json({ message: 'Token is valid' });
    }

    @Post('refresh-token')
    @OutputDto(null) // TODO: type API response
    async refreshToken(@Req() request: Request, @Res() response: Response) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const refreshToken = request.cookies[CookieNames.REFRESH_TOKEN];
        if (!refreshToken) {
            return response
                .status(401)
                .json({ message: 'Refresh token not found' });
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
            const payload = this.jwtService.verify(refreshToken);

            // @ts-ignore

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
            const user = await this.userService.findOneByUUID(payload.uuid, {
                uuid: true,
                email: true,
                role: true,
            });

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!user) {
                return response
                    .status(401)
                    .json({ message: 'Invalid refresh token' });
            }

            const newAuthToken = this.jwtService.sign(
                { uuid: user.uuid },
                { expiresIn: '30m' },
            );
            response.cookie(CookieNames.AUTH_TOKEN, newAuthToken, {
                httpOnly: false,
                secure: env.DEV,
                sameSite: 'strict',
            });
            return response.status(200).json({ message: 'Token refreshed' });
        } catch {
            throw InvalidJwtTokenException;
        }
    }

    @Post('logout')
    @OutputDto(null) // TODO: type API response
    logout(@Res() response: Response): void {
        response.cookie(CookieNames.AUTH_TOKEN, '', {
            httpOnly: false,
            expires: new Date(0),
            secure: true,
        });
        response.cookie(CookieNames.REFRESH_TOKEN, '', {
            httpOnly: true,
            expires: new Date(0),
            secure: true,
        });
        response.status(200).json({ message: 'Logged out' });
    }
}
