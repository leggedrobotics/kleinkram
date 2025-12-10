import { UserService } from '@/services/user.service';
import {
    AccountEntity,
    ApiKeyEntity,
    ProjectAccessViewEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';

@Global()
@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserEntity,
            ApiKeyEntity,
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
            ApiKeyEntity,
            ProjectAccessViewEntity,
        ]),
    ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class UserModule {}
