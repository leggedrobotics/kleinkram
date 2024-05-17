import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import env from '../env';
import { LoggedIn } from './roles.decorator';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const user = req.user;
    const token = await this.authService.login(user);
    console.log(token);
    res.cookie('authtoken', token.access_token, {
      httpOnly: false,
      secure: env.DEV,
      sameSite: 'strict',
    });
    res.cookie('refreshtoken', token.refresh_token, {
      httpOnly: true,
      secure: env.DEV,
      sameSite: 'strict',
    });
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
    const refreshToken = req.cookies['refreshtoken'];
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    try {
      const payload = this.jwtService.verify(refreshToken);
      console.log(payload);
      const user = await this.authService.validateUserByGoogle(
        payload.username,
      );
      console.log(user);
      if (!user) {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const newAccessToken = this.jwtService.sign(
        { username: user.email, sub: user.googleId },
        { expiresIn: '30m' },
      );
      res.cookie('authtoken', newAccessToken, {
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
    res.cookie('authtoken', '', {
      httpOnly: false,
      expires: new Date(0),
      secure: true,
    });
    res.cookie('refreshtoken', '', {
      httpOnly: true,
      expires: new Date(0),
      secure: true,
    });
    res.status(200).json({ message: 'Logged out' });
  }
}
