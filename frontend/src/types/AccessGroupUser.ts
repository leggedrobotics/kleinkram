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

    static fromAPIResponse(response: any): AccessGroupUser | null {
        if (!response) {
            return null;
        }
        const user = User.fromAPIResponse(response.user);
        const accessGroup = response.accessGroup
            ? AccessGroup.fromAPIResponse(response.accessGroup)
            : null;
        return new AccessGroupUser(
            response.uuid,
            new Date(response.createdAt),
            new Date(response.updatedAt),
            user,
            accessGroup,
            response.expirationDate ? new Date(response.expirationDate) : null,
        );
    }
}
