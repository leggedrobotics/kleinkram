import { Controller, Get, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { LoggedIn } from '../auth/roles.decorator';
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
}
