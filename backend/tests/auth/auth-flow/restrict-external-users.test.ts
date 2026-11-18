import { AuthController } from '@/endpoints/auth/auth.controller';
import { JwtStrategy } from '@/endpoints/auth/jwt.strategy';
import {
    AuthService,
    createNewUser,
    EXTERNAL_LOGIN_REFUSED_MESSAGE,
} from '@/services/auth.service';
import {
    InvalidSessionError,
    SessionService,
} from '@/services/session.service';
import { UserService } from '@/services/user.service';
import {
    AccessGroupEntity,
    AccountEntity,
    AffiliationGroupService,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { SessionEntity } from '@kleinkram/backend-common/entities/auth/session.entity';
import env from '@kleinkram/backend-common/environment';
import {
    AccessGroupConfig,
    CookieNames,
    Providers,
    SessionKind,
    UserRole,
} from '@kleinkram/shared';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { database } from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

const GROUP_UUID = '00000000-aaaa-bbbb-cccc-000000000001';

const baseConfig: AccessGroupConfig = {
    emails: [{ email: 'leggedrobotics.com', access_groups: [GROUP_UUID] }],
    access_groups: [{ name: 'Internal', uuid: GROUP_UUID, rights: 10 }],
};

const restrictedConfig: AccessGroupConfig = {
    ...baseConfig,
    allow_external_users: false,
};

const configServiceFor = (config: AccessGroupConfig): ConfigService =>
    ({
        get: (key: string) => (key === 'accessConfig' ? config : undefined),
        getOrThrow: (key: string) => {
            if (key !== 'accessConfig') throw new Error(`no ${key}`);
            return config;
        },
    }) as unknown as ConfigService;

const jwtService = new JwtService({ secret: env.JWT_SECRET });

const sessionServiceFor = (config: AccessGroupConfig): SessionService =>
    new SessionService(
        database.getRepository(SessionEntity),
        jwtService,
        configServiceFor(config),
    );

/** only what JwtStrategy and AuthController use of the UserService */
const userServiceStub = {
    findOneByUUID: (uuid: string) =>
        database.getRepository(UserEntity).findOneOrFail({ where: { uuid } }),
} as unknown as UserService;

/** a token signed before sessions existed: no `sid` */
const legacyToken = (userUuid: string, expiresIn: '30m' | '7d') =>
    jwtService.sign({ uuid: userUuid }, { expiresIn });

interface RecordedResponse {
    status?: number;
    clearedCookies: string[];
    setCookies: string[];
}

/** a minimal express response that records status and cookies */
const recordingResponse = (): {
    response: Response;
    recorded: RecordedResponse;
} => {
    const recorded: RecordedResponse = { clearedCookies: [], setCookies: [] };
    const response = {
        status(code: number) {
            recorded.status = code;
            return response;
        },
        json() {
            return response;
        },
        cookie(name: string, value: string) {
            (value === '' ? recorded.clearedCookies : recorded.setCookies).push(
                name,
            );
            return response;
        },
    };
    return { response: response as unknown as Response, recorded };
};

const refreshWithLegacyToken = async (
    config: AccessGroupConfig,
    refreshToken: string,
): Promise<RecordedResponse> => {
    const controller = new AuthController(
        sessionServiceFor(config),
        jwtService,
        userServiceStub,
    );
    const { response, recorded } = recordingResponse();
    await controller.refreshToken(
        {
            cookies: { [CookieNames.REFRESH_TOKEN]: refreshToken },
            headers: {},
        } as unknown as Request,
        response,
    );
    return recorded;
};

const validateLegacyAccessToken = (
    config: AccessGroupConfig,
    userUuid: string,
): Promise<unknown> =>
    new JwtStrategy(userServiceStub, sessionServiceFor(config)).validate(
        jwtService.decode(legacyToken(userUuid, '30m')),
    );

const googleProfile = (
    id: string,
    email: string,
    verified: boolean | string = true,
) => ({
    id,
    emails: [{ value: email, verified }],
    displayName: 'Test User',
    photos: [{ value: '' }],
});

const userCount = (email: string) =>
    database.getRepository(UserEntity).count({ where: { email } });

describe('Restrict sign-in to internal users (allow_external_users)', () => {
    setupDatabaseHooks();

    let affiliationGroupService: AffiliationGroupService;

    const authServiceFor = (config: AccessGroupConfig): AuthService =>
        new AuthService(
            database.getRepository(AccountEntity),
            database.getRepository(UserEntity),
            affiliationGroupService,
            configServiceFor(config),
        );

    /** an existing user with a linked account, created without restriction */
    const createExistingUser = async (
        oauthID: string,
        email: string,
        provider = Providers.GOOGLE,
    ): Promise<UserEntity> =>
        createNewUser(
            baseConfig,
            database.getRepository(UserEntity),
            database.getRepository(AccountEntity),
            affiliationGroupService,
            { oauthID, provider, email, username: 'Existing', picture: '' },
        );

    beforeAll(() => {
        affiliationGroupService = new AffiliationGroupService(
            database.getRepository(AccessGroupEntity),
            database.getRepository(GroupMembershipEntity),
        );
    });

    beforeEach(async () => {
        await affiliationGroupService.upsertAccessGroups(baseConfig);
    });

    describe('new users', () => {
        test('should create a user with a verified email on an allowed domain', async () => {
            const user = await authServiceFor(
                restrictedConfig,
            ).validateAndCreateUserByGoogle(
                googleProfile('google-internal', 'alice@leggedrobotics.com'),
            );

            expect(user.uuid).toBeDefined();
            expect(await userCount('alice@leggedrobotics.com')).toBe(1);
        });

        test('should refuse a user with an email on another domain', async () => {
            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGoogle(
                    googleProfile('google-external', 'eve@gmail.com'),
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);

            expect(await userCount('eve@gmail.com')).toBe(0);
        });

        test('should refuse a user whose email on an allowed domain is not verified', async () => {
            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGoogle(
                    googleProfile(
                        'google-unverified',
                        'mallory@leggedrobotics.com',
                        false,
                    ),
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);

            expect(await userCount('mallory@leggedrobotics.com')).toBe(0);
        });

        test('should not match a domain that only ends with an allowed domain', async () => {
            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGoogle(
                    googleProfile(
                        'google-lookalike',
                        'eve@evil-leggedrobotics.com',
                    ),
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        });

        test('should use a verified GitHub email on an allowed domain if the primary one is external', async () => {
            const user = await authServiceFor(
                restrictedConfig,
            ).validateAndCreateUserByGitHub({
                id: 'github-secondary',
                displayName: 'Bob',
                photos: [{ value: '' }],
                emails: [
                    { value: 'bob@gmail.com', primary: true, verified: true },
                    {
                        value: 'bob-unverified@leggedrobotics.com',
                        primary: false,
                        verified: false,
                    },
                    {
                        value: 'bob@leggedrobotics.com',
                        primary: false,
                        verified: true,
                    },
                ],
            });

            const stored = await database
                .getRepository(UserEntity)
                .findOneOrFail({
                    where: { uuid: user.uuid },
                    select: { uuid: true, email: true },
                });
            expect(stored.email).toBe('bob@leggedrobotics.com');
        });

        test('should refuse createNewUser for an email on another domain', async () => {
            await expect(
                createNewUser(
                    restrictedConfig,
                    database.getRepository(UserEntity),
                    database.getRepository(AccountEntity),
                    affiliationGroupService,
                    {
                        oauthID: 'direct-external',
                        provider: Providers.GOOGLE,
                        email: 'direct@gmail.com',
                        username: 'Direct',
                        picture: '',
                    },
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        });
    });

    describe('existing users', () => {
        test('should let an existing user with an email on an allowed domain log in', async () => {
            const existing = await createExistingUser(
                'google-existing-internal',
                'carol@leggedrobotics.com',
            );

            const user = await authServiceFor(
                restrictedConfig,
            ).validateAndCreateUserByGoogle(
                googleProfile(
                    'google-existing-internal',
                    'carol@leggedrobotics.com',
                ),
            );

            expect(user.uuid).toBe(existing.uuid);
        });

        test('should refuse an existing user with an email on another domain', async () => {
            await createExistingUser(
                'google-existing-external',
                'dave@gmail.com',
            );

            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGoogle(
                    googleProfile('google-existing-external', 'dave@gmail.com'),
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        });

        test('should refuse an existing admin with an email on another domain', async () => {
            const admin = await createExistingUser(
                'google-existing-admin',
                'admin@gmail.com',
            );
            await database
                .getRepository(UserEntity)
                .update({ uuid: admin.uuid }, { role: UserRole.ADMIN });

            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGoogle(
                    googleProfile('google-existing-admin', 'admin@gmail.com'),
                ),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        });

        test('should refuse an existing user whose provider no longer has a verified email on an allowed domain', async () => {
            await createExistingUser(
                'github-left-company',
                'frank@leggedrobotics.com',
                Providers.GITHUB,
            );

            // the work address was removed from the GitHub account
            await expect(
                authServiceFor(restrictedConfig).validateAndCreateUserByGitHub({
                    id: 'github-left-company',
                    displayName: 'Frank',
                    photos: [{ value: '' }],
                    emails: [
                        {
                            value: 'frank@gmail.com',
                            primary: true,
                            verified: true,
                        },
                    ],
                }),
            ).rejects.toThrow(EXTERNAL_LOGIN_REFUSED_MESSAGE);
        });

        test('should refuse to refresh the session of a user with an email on another domain', async () => {
            const user = await createExistingUser(
                'google-session-external',
                'grace@gmail.com',
            );
            const { tokens } = await sessionServiceFor(baseConfig).create(
                user,
                {
                    kind: SessionKind.WEB,
                },
            );

            await expect(
                sessionServiceFor(restrictedConfig).refresh(
                    tokens[CookieNames.REFRESH_TOKEN],
                    undefined,
                ),
            ).rejects.toThrow(InvalidSessionError);
        });

        test('should refresh the session of a user with an email on an allowed domain', async () => {
            const user = await createExistingUser(
                'google-session-internal',
                'heidi@leggedrobotics.com',
            );
            const { tokens } = await sessionServiceFor(baseConfig).create(
                user,
                {
                    kind: SessionKind.WEB,
                },
            );

            const result = await sessionServiceFor(restrictedConfig).refresh(
                tokens[CookieNames.REFRESH_TOKEN],
                undefined,
            );
            expect(result.session.userUuid).toBe(user.uuid);
        });

        test('should reject access tokens of a user with an email on another domain', async () => {
            const external = await createExistingUser(
                'google-token-external',
                'ivan@gmail.com',
            );
            const internal = await createExistingUser(
                'google-token-internal',
                'judy@leggedrobotics.com',
            );
            const externalSession = await sessionServiceFor(baseConfig).create(
                external,
                { kind: SessionKind.WEB },
            );
            const internalSession = await sessionServiceFor(baseConfig).create(
                internal,
                { kind: SessionKind.WEB },
            );

            const restricted = sessionServiceFor(restrictedConfig);
            expect(
                await restricted.findActiveForAccessToken({
                    uuid: external.uuid,
                    sid: externalSession.session.uuid,
                }),
            ).toBeNull();
            expect(
                await restricted.findActiveForAccessToken({
                    uuid: internal.uuid,
                    sid: internalSession.session.uuid,
                }),
            ).not.toBeNull();

            // unchanged without the restriction
            expect(
                await sessionServiceFor(baseConfig).findActiveForAccessToken({
                    uuid: external.uuid,
                    sid: externalSession.session.uuid,
                }),
            ).not.toBeNull();
        });
    });

    describe('tokens from before sessions', () => {
        test('should reject the legacy access token of a user with an email on another domain', async () => {
            const user = await createExistingUser(
                'google-legacy-access-external',
                'kim@gmail.com',
            );

            await expect(
                validateLegacyAccessToken(restrictedConfig, user.uuid),
            ).rejects.toThrow(UnauthorizedException);

            // unchanged without the restriction
            await expect(
                validateLegacyAccessToken(baseConfig, user.uuid),
            ).resolves.toMatchObject({ user: { uuid: user.uuid } });
        });

        test('should accept the legacy access token of a user with an email on an allowed domain', async () => {
            const user = await createExistingUser(
                'google-legacy-access-internal',
                'liam@leggedrobotics.com',
            );

            await expect(
                validateLegacyAccessToken(restrictedConfig, user.uuid),
            ).resolves.toMatchObject({ user: { uuid: user.uuid } });
        });

        test('should refuse a legacy refresh of a user with an email on another domain and clear both cookies', async () => {
            const user = await createExistingUser(
                'google-legacy-refresh-external',
                'mia@gmail.com',
            );

            const recorded = await refreshWithLegacyToken(
                restrictedConfig,
                legacyToken(user.uuid, '7d'),
            );

            expect(recorded.status).toBe(401);
            expect(recorded.setCookies).toEqual([]);
            expect(recorded.clearedCookies).toEqual(
                expect.arrayContaining([
                    CookieNames.AUTH_TOKEN,
                    CookieNames.REFRESH_TOKEN,
                ]),
            );
        });

        test('should refresh a legacy token of a user with an email on an allowed domain', async () => {
            const user = await createExistingUser(
                'google-legacy-refresh-internal',
                'noah@leggedrobotics.com',
            );

            const recorded = await refreshWithLegacyToken(
                restrictedConfig,
                legacyToken(user.uuid, '7d'),
            );

            expect(recorded.status).toBe(200);
            expect(recorded.setCookies).toEqual([CookieNames.AUTH_TOKEN]);
            expect(recorded.clearedCookies).toEqual([]);
        });
    });

    describe('without allow_external_users', () => {
        test('should create a user with an email on another domain', async () => {
            const user = await authServiceFor(
                baseConfig,
            ).validateAndCreateUserByGoogle(
                googleProfile('google-unrestricted', 'oscar@gmail.com', false),
            );

            expect(user.uuid).toBeDefined();
            expect(await userCount('oscar@gmail.com')).toBe(1);
        });

        test('should use the primary GitHub email as before', async () => {
            const user = await authServiceFor(
                baseConfig,
            ).validateAndCreateUserByGitHub({
                id: 'github-unrestricted',
                displayName: 'Peggy',
                photos: [{ value: '' }],
                emails: [
                    {
                        value: 'peggy@leggedrobotics.com',
                        primary: false,
                        verified: true,
                    },
                    {
                        value: 'peggy@gmail.com',
                        primary: true,
                        verified: false,
                    },
                ],
            });

            const stored = await database
                .getRepository(UserEntity)
                .findOneOrFail({
                    where: { uuid: user.uuid },
                    select: { uuid: true, email: true },
                });
            expect(stored.email).toBe('peggy@gmail.com');
        });

        test('should let an existing user with an email on another domain log in', async () => {
            const existing = await createExistingUser(
                'google-unrestricted-existing',
                'trent@gmail.com',
            );

            const user = await authServiceFor(
                baseConfig,
            ).validateAndCreateUserByGoogle(
                googleProfile(
                    'google-unrestricted-existing',
                    'trent@gmail.com',
                ),
            );
            expect(user.uuid).toBe(existing.uuid);
        });
    });
});
