import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import User from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],

  providers: [UserService],
})
export class UserModule {}
