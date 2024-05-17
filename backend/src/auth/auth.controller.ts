import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import env from '../env';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const user = req.user;
    const token = await this.authService.login(user);
    res.cookie('token', token.access_token, {
      httpOnly: true,
      secure: env.DEV,
      sameSite: 'strict',
    });
    res.redirect(`${env.FRONTEND_URL}/#/landing`);
  }
}
