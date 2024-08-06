import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import Account from '@common/entities/auth/account.entity';


@Module({
    imports: [TypeOrmModule.forFeature([User, Apikey, Account])],
    controllers: [UserController],
    providers: [UserService],
})
export class UserModule {
}
