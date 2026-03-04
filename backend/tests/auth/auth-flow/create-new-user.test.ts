import { AuthFlowException } from '@/types/auth-flow-exception';
import { createNewUser } from '@/services/auth.service';
import { AffiliationGroupService } from '@kleinkram/backend-common';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupConfig, Providers } from '@kleinkram/shared';
import { Repository } from 'typeorm';

describe('createNewUser affiliation sync', () => {
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

    test('links existing user without account and backfills affiliation membership', async () => {
        const existingUser = {
            uuid: 'user-1',
            email: 'marina@leggedrobotics.com',
            account: undefined,
        } as unknown as UserEntity;

        const createdAccount = { uuid: 'account-1' } as AccountEntity;

        const userRepository = {
            findOne: jest.fn().mockResolvedValue(existingUser),
        } as unknown as Repository<UserEntity>;

        const accountRepository = {
            create: jest.fn().mockReturnValue(createdAccount),
            save: jest.fn().mockResolvedValue(createdAccount),
        } as unknown as Repository<AccountEntity>;

        const affiliationGroupService = {
            addToAffiliationGroups: jest.fn().mockResolvedValue(undefined),
            createPrimaryGroup: jest.fn().mockResolvedValue(undefined),
        } as unknown as AffiliationGroupService;

        const user = await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: 'oauth-id',
                provider: Providers.GOOGLE,
                email: 'marina@leggedrobotics.com',
                username: 'Marina',
                picture: '',
            },
        );

        expect(user).toBe(existingUser);
        expect(accountRepository.save).toHaveBeenCalledWith(createdAccount);
        expect(affiliationGroupService.addToAffiliationGroups).toHaveBeenCalledWith(
            config,
            existingUser,
        );
        expect(affiliationGroupService.createPrimaryGroup).not.toHaveBeenCalled();
    });

    test('throws when user already exists with a linked account', async () => {
        const existingUser = {
            uuid: 'user-2',
            email: 'already@leggedrobotics.com',
            account: { uuid: 'account-existing' },
        } as unknown as UserEntity;

        const userRepository = {
            findOne: jest.fn().mockResolvedValue(existingUser),
        } as unknown as Repository<UserEntity>;

        const accountRepository = {
            create: jest.fn(),
            save: jest.fn(),
        } as unknown as Repository<AccountEntity>;

        const affiliationGroupService = {
            addToAffiliationGroups: jest.fn(),
            createPrimaryGroup: jest.fn(),
        } as unknown as AffiliationGroupService;

        await expect(
            createNewUser(
                config,
                userRepository,
                accountRepository,
                affiliationGroupService,
                {
                    oauthID: 'oauth-id',
                    provider: Providers.GOOGLE,
                    email: 'already@leggedrobotics.com',
                    username: 'Existing',
                    picture: '',
                },
            ),
        ).rejects.toBeInstanceOf(AuthFlowException);

        expect(affiliationGroupService.addToAffiliationGroups).not.toHaveBeenCalled();
        expect(accountRepository.save).not.toHaveBeenCalled();
    });
});
