import { Global, Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import User from '@common/entities/user/user.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import Account from '@common/entities/auth/account.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            Apikey,
            Account,
            ProjectAccessViewEntity,
        ]),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [
        UserService,
        TypeOrmModule.forFeature([User, Apikey, ProjectAccessViewEntity]),
    ],
})
export class UserModule {}
