import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import env from '../env';
import { LoggedIn } from './roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { CookieNames } from '../enum';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
    ) {}

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req) {}

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req, @Res() res: Response) {
        const account = req.user;
        const token = await this.authService.login(account);
        const state = req.query.state;
        if (state == 'cli') {
            res.redirect(
                `http://localhost:8000/cli/callback?${CookieNames.AUTH_TOKEN}=${token[CookieNames.AUTH_TOKEN]}&${CookieNames.REFRESH_TOKEN}=${token[CookieNames.REFRESH_TOKEN]}`,
            );
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
            },
        );
        res.redirect(`${env.FRONTEND_URL}/#/landing`);
    }

    @Get('validate-token')
    @LoggedIn()
    validateToken(@Req() req: Request, @Res() res: Response) {
        // If we reach here, the token is valid
        res.status(200).json({ message: 'Token is valid' });
    }

    @Post('refresh-token')
    async refreshToken(@Req() req: Request, @Res() res: Response) {
        const refreshToken = req.cookies[CookieNames.REFRESH_TOKEN];
        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        try {
            const payload = this.jwtService.verify(refreshToken);
            const user = await this.userService.findOneById(payload.uuid);
            if (!user) {
                return res
                    .status(401)
                    .json({ message: 'Invalid refresh token' });
            }

            const newAuthToken = this.jwtService.sign(
                { uuid: user.account.uuid },
                { expiresIn: '30m' },
            );
            res.cookie(CookieNames.AUTH_TOKEN, newAuthToken, {
                httpOnly: false,
                secure: env.DEV,
                sameSite: 'strict',
            });
            res.status(200).json({ message: 'Token refreshed' });
        } catch (e) {
            console.log(e);
            return res.status(401).json({ message: 'Invalid refresh token' });
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
