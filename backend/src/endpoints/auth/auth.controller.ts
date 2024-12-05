import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from '../../services/auth.service';
import { UserOnly } from './roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../../services/user.service';
import { CookieNames } from '@common/frontend_shared/enum';
import env from '@common/env';
import { InvalidJwtTokenException } from './jwt.strategy';
import { OutputDto } from '../../decarators';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
    ) {}

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(): Promise<void> {
        // Initiates the Google OAuth flow
        // OAuth is handled by the AuthGuard
    }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    @OutputDto(null) // explicitly disabled DTO output check
    googleAuthRedirect(@Req() request, @Res() response: Response): void {
        const user = request.user;
        const token = this.authService.login(user);
        const state = request.query.state;
        if (state === 'cli') {
            response.redirect(
                `http://localhost:8000/cli/callback?${CookieNames.AUTH_TOKEN}=${token[CookieNames.AUTH_TOKEN]}&${CookieNames.REFRESH_TOKEN}=${token[CookieNames.REFRESH_TOKEN]}`,
            );
            return;
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
                    textArea.value = copyText.textContent; // use textContent since innerText may include extra padding in some cases
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
    @OutputDto(null) // explicitly disabled DTO output check
    validateToken(@Res() response: Response): void {
        // If we reach here, the token is valid
        response.status(200).json({ message: 'Token is valid' });
    }

    @Post('refresh-token')
    @OutputDto(null) // explicitly disabled DTO output check
    async refreshToken(@Req() request: Request, @Res() response: Response) {
        const refreshToken = request.cookies[CookieNames.REFRESH_TOKEN];
        if (!refreshToken) {
            return response
                .status(401)
                .json({ message: 'Refresh token not found' });
        }

        try {
            const payload = this.jwtService.verify(refreshToken);

            // @ts-ignore
            const user = await this.userService.findOneByUUID(payload.uuid, {
                uuid: true,
                email: true,
                role: true,
            });

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
            response.status(200).json({ message: 'Token refreshed' });
        } catch {
            throw InvalidJwtTokenException;
        }
    }

    @Post('logout')
    @OutputDto(null) // explicitly disabled DTO output check
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
