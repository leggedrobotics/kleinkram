import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from './entities/user.entity';
import { UserRole } from '../enum';
import { JWTUser } from '../auth/paramDecorator';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  async findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async findOneById(googleId: string) {
    return this.userRepository.findOneOrFail({ where: { googleId } });
  }
  async create(googleId: string, email: string, username: string) {
    const res = this.userRepository.create({
      email: email,
      name: username,
      googleId: googleId,
      role: UserRole.USER,
    });
    await this.userRepository.save(res);
    return this.userRepository.findOneOrFail({ where: { email } });
  }

  async claimAdmin(jwtuser: JWTUser) {
    const nrAdmins = await this.userRepository.count({
      where: { role: UserRole.ADMIN },
    });
    if (nrAdmins > 0) {
      throw new ForbiddenException('Admin already exists');
    }
    const user = await this.userRepository.findOneOrFail({
      where: { googleId: jwtuser.userId },
    });

    user.role = UserRole.ADMIN;
    await this.userRepository.save(user);
    return user;
  }

  async findAll() {
    return this.userRepository.find();
  }
}
