import { BaseEntity } from 'src/types/BaseEntity';
import { User } from 'src/types/User';
import { AccessGroup } from 'src/types/AccessGroup';

export class AccessGroupUser extends BaseEntity {
    user: User | null;
    accessGroup: AccessGroup | null;
    expirationDate: Date | null;
    constructor(
        uuid: string,
        createdAt: Date | null,
        updatedAt: Date | null,
        user: User | null,
        accessGroup: AccessGroup | null,
        expirationDate: Date | null = null,
    ) {
        super(uuid, createdAt, updatedAt);
        this.user = user;
        this.accessGroup = accessGroup;
        this.expirationDate = expirationDate;
    }
}
