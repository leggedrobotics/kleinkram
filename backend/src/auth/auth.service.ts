import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUserByGoogle(profile: any): Promise<any> {
    const { id, emails, displayName } = profile;
    const email = emails[0].value;

    let user = await this.userService.findOneByEmail(email);
    if (!user) {
      user = await this.userService.create({
        googleId: id,
        email,
        displayName,
      });
    }
    return user;
  }
  async login(user: any) {
    const payload = { username: user.email, sub: user.userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
