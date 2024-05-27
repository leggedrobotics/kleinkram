import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import User from './entities/user.entity';
import { UserController } from './user.controller';
import Token from '../auth/entities/token.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Token])],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
