import {
    accessGroupEntityToDto,
    groupMembershipEntityToDto,
} from '@/serialization';
import {
    AccessGroupDto,
    GroupMembershipDto,
    UserDto,
} from '@kleinkram/api-dto';
import { AccessGroupEntity } from '@kleinkram/backend-common';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { AccessGroupType, UserRole } from '@kleinkram/shared';

// Regression tests for #2368. With `plainToInstance`, class-transformer applies
// `@Type` before `@Transform`, so a transform that returns `obj.<key>` replaces
// the converted DTO with the raw entity and leaks non-exposed fields.

const createdAt = new Date('2024-01-01');
const updatedAt = new Date('2024-01-02');

const user = {
    uuid: 'a2d3f7e0-0000-4000-8000-000000000001',
    name: 'user',
    avatarUrl: 'https://example.com/avatar.png',
    email: 'user@example.com',
    role: UserRole.USER,
    createdAt,
    updatedAt,
};

const accessGroup = (): AccessGroupEntity =>
    ({
        uuid: 'a2d3f7e0-0000-4000-8000-000000000002',
        name: 'group',
        createdAt,
        updatedAt,
        type: AccessGroupType.CUSTOM,
        hidden: false,
        emailPattern: undefined,
        deletedAt: null,
        creator: user,
        memberships: [],
        projectAccesses: [],
    }) as unknown as AccessGroupEntity;

const membership = (): GroupMembershipEntity =>
    ({
        uuid: 'a2d3f7e0-0000-4000-8000-000000000003',
        createdAt,
        updatedAt,
        expirationDate: null,
        canEditGroup: true,
        user,
        accessGroup: accessGroup(),
    }) as unknown as GroupMembershipEntity;

describe('GroupMembershipDto serialization', () => {
    test('serializes accessGroup as an AccessGroupDto', () => {
        const dto = groupMembershipEntityToDto(
            membership(),
            false,
            undefined,
            true,
        );

        expect(dto).toBeInstanceOf(GroupMembershipDto);
        expect(dto.accessGroup).toBeInstanceOf(AccessGroupDto);
        expect(dto.accessGroup).not.toHaveProperty('deletedAt');
        expect(dto.accessGroup?.creator).toBeInstanceOf(UserDto);
        expect(dto.accessGroup?.creator?.email).toBeNull();
        expect(dto.accessGroup?.creator).not.toHaveProperty('role');
    });

    test('omits accessGroup unless requested', () => {
        const dto = groupMembershipEntityToDto(membership());

        expect(dto.accessGroup).toBeNull();
    });
});

describe('AccessGroupDto serialization', () => {
    test('serializes creator and memberships as DTOs', () => {
        const group = accessGroup();
        group.memberships = [membership()];

        const dto = accessGroupEntityToDto(group);

        expect(dto.creator).toBeInstanceOf(UserDto);
        expect(dto.creator?.email).toBeNull();
        expect(dto.creator).not.toHaveProperty('role');
        expect(dto.memberships).toHaveLength(1);
        expect(dto.memberships[0]).toBeInstanceOf(GroupMembershipDto);
        expect(dto.memberships[0]?.user).not.toHaveProperty('role');
    });

    test('defaults creator and memberships when relations are not loaded', () => {
        const group = accessGroup();
        delete (group as Partial<AccessGroupEntity>).creator;
        delete (group as Partial<AccessGroupEntity>).memberships;

        const dto = accessGroupEntityToDto(group);

        expect(dto.creator).toBeNull();
        expect(dto.memberships).toEqual([]);
    });
});
