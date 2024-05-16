import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}
  async findOneByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(user: any) {
    const res = this.userRepository.create({
      email: user.email,
      name: user.username,
    });
    await this.userRepository.save(res);
    return this.userRepository.findOneOrFail({ where: { email: user.email } });
  }
}
