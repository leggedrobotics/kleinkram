import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../user/user.service';
import { UserRole } from '../enum';
import { InjectRepository } from '@nestjs/typeorm';
import User from '../user/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PublicGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true; // Always allow access
  }
}

@Injectable()
export class LoggedInUserGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

@Injectable()
export class AdminOnlyGuard extends AuthGuard('jwt') {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private reflector: Reflector,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context); // Ensure the user is authenticated first

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not logged in');
    }

    const userFromDb = await this.userRepository.findOne({
      where: { googleId: user.userId },
    });

    if (userFromDb.role !== UserRole.ADMIN) {
      throw new ForbiddenException('User is not an admin');
    }

    return true;
  }
}
