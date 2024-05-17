import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from './entities/user.entity';
import { UserRole } from '../enum';

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
}
