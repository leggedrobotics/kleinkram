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
            email: 'internal-user@leggedrobotics.com',
            account: undefined,
        } as unknown as UserEntity;

        const createdAccount = { uuid: 'account-1' } as AccountEntity;
        const findUser = jest.fn().mockResolvedValue(existingUser);
        const createAccount = jest.fn().mockReturnValue(createdAccount);
        const saveAccount = jest.fn().mockResolvedValue(createdAccount);
        const addToAffiliationGroups = jest.fn().mockResolvedValue();
        const createPrimaryGroup = jest.fn().mockResolvedValue();

        const userRepository = {
            findOne: findUser,
        } as unknown as Repository<UserEntity>;

        const accountRepository = {
            create: createAccount,
            save: saveAccount,
        } as unknown as Repository<AccountEntity>;

        const affiliationGroupService = {
            addToAffiliationGroups,
            createPrimaryGroup,
        } as unknown as AffiliationGroupService;

        const user = await createNewUser(
            config,
            userRepository,
            accountRepository,
            affiliationGroupService,
            {
                oauthID: 'oauth-id',
                provider: Providers.GOOGLE,
                email: 'internal-user@leggedrobotics.com',
                username: 'Internal User',
                picture: '',
            },
        );

        expect(user).toBe(existingUser);
        expect(saveAccount).toHaveBeenCalledWith(createdAccount);
        expect(addToAffiliationGroups).toHaveBeenCalledWith(config, existingUser);
        expect(createPrimaryGroup).not.toHaveBeenCalled();
    });

    test('throws when user already exists with a linked account', async () => {
        const existingUser = {
            uuid: 'user-2',
            email: 'already@leggedrobotics.com',
            account: { uuid: 'account-existing' },
        } as unknown as UserEntity;
        const findUser = jest.fn().mockResolvedValue(existingUser);
        const createAccount = jest.fn();
        const saveAccount = jest.fn();
        const addToAffiliationGroups = jest.fn();
        const createPrimaryGroup = jest.fn();

        const userRepository = {
            findOne: findUser,
        } as unknown as Repository<UserEntity>;

        const accountRepository = {
            create: createAccount,
            save: saveAccount,
        } as unknown as Repository<AccountEntity>;

        const affiliationGroupService = {
            addToAffiliationGroups,
            createPrimaryGroup,
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

        expect(addToAffiliationGroups).not.toHaveBeenCalled();
        expect(saveAccount).not.toHaveBeenCalled();
    });
});
