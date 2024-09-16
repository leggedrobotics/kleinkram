import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { Repository } from 'typeorm';
import { UserRole } from '@common/enum';
import User from '@common/entities/user/user.entity';

@Injectable()
export class AuthGuardService {
    constructor(
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async canAddUserToAccessGroup(userUUID: string, accessGroupUUID: string) {
        if (!userUUID || !accessGroupUUID) {
            return false;
        }
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }

        return await this.accessGroupRepository.exists({
            where: { uuid: accessGroupUUID, creator: { uuid: userUUID } },
            relations: ['users'],
        });
    }
}
