import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminOnly, LoggedIn } from '../auth/roles.decorator';
import { JWTUser } from 'src/auth/paramDecorator';
import { addJWTUser } from '../auth/paramDecorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('claimAdmin')
  @LoggedIn()
  async claimAdmin(@addJWTUser() user?: JWTUser) {
    return this.userService.claimAdmin(user);
  }

  @Get('all')
  @LoggedIn()
  async allUsers() {
    return this.userService.findAll();
  }

  @Get('me')
  @LoggedIn()
  async me(@addJWTUser() user?: JWTUser) {
    return this.userService.me(user);
  }

  @Post('promote')
  @AdminOnly()
  async promoteUser(@Body() bd: { email: string }) {
    return this.userService.promoteUser(bd.email);
  }

  @Post('demote')
  @AdminOnly()
  async demoteUser(@Body() bd: { email: string }) {
    return this.userService.demoteUser(bd.email);
  }
}
