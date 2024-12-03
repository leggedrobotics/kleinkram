import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { UserOnly } from './roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../user/user.service';
import { CookieNames } from '@common/frontend_shared/enum';
import env from '@common/env';
import { InvalidJwtTokenException } from './jwt.strategy';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
    ) {}

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {}

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    googleAuthRedirect(@Req() request, @Res() res: Response) {
        const user = request.user;
        const token = this.authService.login(user);
        const state = request.query.state;
        if (state === 'cli') {
            res.redirect(
                `http://localhost:8000/cli/callback?${CookieNames.AUTH_TOKEN}=${token[CookieNames.AUTH_TOKEN]}&${CookieNames.REFRESH_TOKEN}=${token[CookieNames.REFRESH_TOKEN]}`,
            );
            return;
        }
        if (state === 'cli-no-redirect') {
            const authToken = token[CookieNames.AUTH_TOKEN];
            const refreshToken = token[CookieNames.REFRESH_TOKEN];
            res.status(200).send(`
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
        res.cookie(CookieNames.AUTH_TOKEN, token[CookieNames.AUTH_TOKEN], {
            httpOnly: false,
            secure: env.DEV,
            sameSite: 'strict',
        });
        res.cookie(
            CookieNames.REFRESH_TOKEN,
            token[CookieNames.REFRESH_TOKEN],
            {
                httpOnly: true,
                secure: env.DEV,
                sameSite: 'strict',
                maxAge: 30 * 24 * 60 * 60 * 1000,
            },
        );
        res.redirect(`${env.FRONTEND_URL}/landing`);
    }

    @Get('validate-token')
    @UserOnly()
    validateToken(@Req() request: Request, @Res() res: Response) {
        // If we reach here, the token is valid
        res.status(200).json({ message: 'Token is valid' });
    }

    @Post('refresh-token')
    async refreshToken(@Req() request: Request, @Res() res: Response) {
        const refreshToken = request.cookies[CookieNames.REFRESH_TOKEN];
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
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
                return res
                    .status(401)
                    .json({ message: 'Invalid refresh token' });
            }

            const newAuthToken = this.jwtService.sign(
                { uuid: user.uuid },
                { expiresIn: '30m' },
            );
            res.cookie(CookieNames.AUTH_TOKEN, newAuthToken, {
                httpOnly: false,
                secure: env.DEV,
                sameSite: 'strict',
            });
            res.status(200).json({ message: 'Token refreshed' });
        } catch {
            throw InvalidJwtTokenException;
        }
    }

    @Post('logout')
    logout(@Res() res: Response) {
        res.cookie(CookieNames.AUTH_TOKEN, '', {
            httpOnly: false,
            expires: new Date(0),
            secure: true,
        });
        res.cookie(CookieNames.REFRESH_TOKEN, '', {
            httpOnly: true,
            expires: new Date(0),
            secure: true,
        });
        res.status(200).json({ message: 'Logged out' });
    }
}
