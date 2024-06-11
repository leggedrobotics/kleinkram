import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import User from './entities/user.entity';
import { UserController } from './user.controller';
import Apikey from '../auth/entities/apikey.entity';
import Account from '../auth/entities/account.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, Apikey, Account])],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {}
