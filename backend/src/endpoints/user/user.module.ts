import Account from '@common/entities/auth/account.entity';
import Apikey from '@common/entities/auth/apikey.entity';
import User from '@common/entities/user/user.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/project-access-view.entity';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../../services/user.service';
import { UserController } from './user.controller';

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
