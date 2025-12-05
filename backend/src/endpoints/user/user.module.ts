import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { ApikeyEntity } from '@kleinkram/backend-common/entities/auth/apikey.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../../services/user.service';
import { UserController } from './user.controller';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserEntity,
            ApikeyEntity,
            AccountEntity,
            ProjectAccessViewEntity,
        ]),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [
        UserService,
        TypeOrmModule.forFeature([
            UserEntity,
            ApikeyEntity,
            ProjectAccessViewEntity,
        ]),
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class UserModule {}
