import { AuthService } from '@/services/auth.service';
import { AffiliationGroupService } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupConfig } from '@kleinkram/shared';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';

describe('AuthService affiliation sync', () => {
    const config = {
        emails: [
            {
                email: 'leggedrobotics.com',
                access_groups: ['00000000-0000-0000-0000-000000000000'],
            },
        ],
        access_groups: [
            {
                name: 'Leggedrobotics',
                uuid: '00000000-0000-0000-0000-000000000000',
                rights: 10,
            },
        ],
    } as unknown as AccessGroupConfig;

    const setup = () => {
        const user = {
            uuid: 'user-1',
        } as UserEntity;
        const account = { user } as AccountEntity;

        const accountRepository = {
            findOne: jest.fn().mockResolvedValue(account),
        } as unknown as Repository<AccountEntity>;

        const userRepository = {} as Repository<UserEntity>;

        const addToAffiliationGroups = jest
            .fn()
            .mockImplementation(() => Promise.resolve());
        const affiliationGroupService = {
            addToAffiliationGroups,
            createAccessGroups: jest
                .fn()
                .mockImplementation(() => Promise.resolve()),
        } as unknown as AffiliationGroupService;

        const configService = {
            get: jest.fn().mockReturnValue(config),
        } as unknown as ConfigService;

        const jwtService = {} as JwtService;

        const authService = new AuthService(
            jwtService,
            accountRepository,
            userRepository,
            affiliationGroupService,
            configService,
        );

        return {
            authService,
            addToAffiliationGroups,
            user,
        };
    };

    test('syncs affiliation for existing Google account using OAuth email fallback', async () => {
        const { authService, addToAffiliationGroups, user } = setup();
        const email = 'marina@leggedrobotics.com';
        const profile = {
            id: 'oauth-id',
            emails: [{ value: email }],
            displayName: 'Marina',
            photos: [{ value: 'https://example.com/avatar.jpg' }],
        };

        const returnedUser =
            await authService.validateAndCreateUserByGoogle(profile);

        expect(returnedUser).toBe(user);
        expect(addToAffiliationGroups).toHaveBeenCalledWith(config, {
            uuid: 'user-1',
            email,
        });
    });

    test('syncs affiliation for existing GitHub account using OAuth email fallback', async () => {
        const { authService, addToAffiliationGroups, user } = setup();
        const email = 'claudio@leggedrobotics.com';
        const profile = {
            id: 'oauth-id',
            emails: [{ value: email }],
            displayName: 'Claudio',
            photos: [{ value: 'https://example.com/avatar.jpg' }],
        };

        const returnedUser =
            await authService.validateAndCreateUserByGitHub(profile);

        expect(returnedUser).toBe(user);
        expect(addToAffiliationGroups).toHaveBeenCalledWith(config, {
            uuid: 'user-1',
            email,
        });
    });

    test('syncs affiliation for existing FakeOAuth account using direct email', async () => {
        const { authService, addToAffiliationGroups, user } = setup();
        const email = 'internal-user@leggedrobotics.com';
        const profile = {
            id: 'oauth-id',
            email,
            displayName: 'Internal User',
            photo: 'https://example.com/avatar.jpg',
        };

        const returnedUser =
            await authService.validateAndCreateUserByFakeOAuth(profile);

        expect(returnedUser).toBe(user);
        expect(addToAffiliationGroups).toHaveBeenCalledWith(config, {
            uuid: 'user-1',
            email,
        });
    });
});
