import { DeviceAuthorizationService } from '@/services/device-authorization.service';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CliController } from './cli.controller';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [CliController],
    providers: [DeviceAuthorizationService],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CliModule {}
