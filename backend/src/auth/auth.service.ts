import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import User from '../user/entities/user.entity';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class AuthService {
    constructor(
        private userService: UserService,
        private jwtService: JwtService,
    ) {}

    async validateAndCreateUserByGoogle(profile: any): Promise<User> {
        const { id, emails, displayName } = profile;
        console.log(profile);
        const email = emails[0].value;
        let user = await this.userService.findOneByEmail(email);
        if (!user) {
            user = await this.userService.create(id, email, displayName);
        }
        return user;
    }

    async validateUserByGoogle(email: string): Promise<User> {
        return await this.userService.findOneByEmail(email);
    }
    async login(user: User) {
        console.log(user);
        const payload: JwtPayload = {
            username: user.email,
            sub: user.googleId,
        };
        return {
            access_token: this.jwtService.sign(payload, { expiresIn: '30m' }),
            refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
        };
    }
}
