import type {
    DeviceAuthorizationDto,
    DeviceTokenDto,
    SessionsDto,
} from '@kleinkram/api-dto';
import { SessionEntity } from '@kleinkram/backend-common/entities/auth/session.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import jwt from 'jsonwebtoken';
import { getAuthHeaders } from '../../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

// eslint-disable-next-line @typescript-eslint/naming-convention
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CLI_VERSION = '0.67.0';

interface Tokens {
    authToken: string;
    refreshToken: string;
}

/** Logs in like the CLI does: device login approved by `user`. */
const cliLogin = async (user: UserEntity): Promise<Tokens> => {
    const start = await fetch(`${DEFAULT_URL}/cli/device`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), ...JSON_HEADERS },
        body: JSON.stringify({
            hostname: 'anymal-d-042',
            cliVersion: '0.67.0',
        }),
    });
    const authorization = (await start.json()) as DeviceAuthorizationDto;
    await fetch(`${DEFAULT_URL}/cli/device/${authorization.userCode}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(user),
    });
    const poll = await fetch(`${DEFAULT_URL}/cli/device/token`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), ...JSON_HEADERS },
        body: JSON.stringify({ deviceCode: authorization.deviceCode }),
    });
    const tokens = (await poll.json()) as DeviceTokenDto;
    return {
        authToken: tokens.authToken ?? '',
        refreshToken: tokens.refreshToken ?? '',
    };
};

const cookieValue = (response: Response, name: string): string | undefined =>
    response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0] ?? '')
        .find((pair) => pair.startsWith(`${name}=`))
        ?.slice(name.length + 1);

const refresh = async (
    refreshToken: string,
    clientVersion = CLI_VERSION,
): Promise<{
    status: number;
    authToken?: string | undefined;
    refreshToken?: string | undefined;
}> => {
    const response = await fetch(`${DEFAULT_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'kleinkram-client-version': clientVersion,
            cookie: `refreshtoken=${refreshToken}`,
        },
    });
    return {
        status: response.status,
        authToken: cookieValue(response, 'authtoken'),
        refreshToken: cookieValue(response, 'refreshtoken'),
    };
};

const me = async (authToken: string): Promise<number> => {
    const response = await fetch(`${DEFAULT_URL}/users/me`, {
        headers: { ...getAuthHeaders(), cookie: `authtoken=${authToken}` },
    });
    return response.status;
};

const listSessions = async (authToken: string): Promise<SessionsDto> => {
    const response = await fetch(`${DEFAULT_URL}/users/me/sessions`, {
        headers: { ...getAuthHeaders(), cookie: `authtoken=${authToken}` },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as SessionsDto;
};

const refreshStatus = async (
    refreshToken: string,
    clientVersion = CLI_VERSION,
): Promise<number> => {
    const result = await refresh(refreshToken, clientVersion);
    return result.status;
};

const sessionUuidOf = (authToken: string): string =>
    (jwt.decode(authToken) as { sid: string }).sid;

const newUser = async (email: string, role = UserRole.USER) =>
    getUserFromDatabase(await mockDatabaseUser(email, email, role));

describe('User Sessions', () => {
    setupDatabaseHooks();

    test('should list a CLI login as a session of the user', async () => {
        const user = await newUser('session-list@leggedrobotics.com');
        const tokens = await cliLogin(user);

        expect(tokens.refreshToken.startsWith('ks1.')).toBe(true);
        expect(await me(tokens.authToken)).toBe(200);

        const { sessions } = await listSessions(tokens.authToken);
        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
            kind: 'CLI',
            name: 'anymal-d-042',
            current: true,
        });
    });

    test('should rotate the refresh token and accept the previous one only briefly', async () => {
        const user = await newUser('session-rotate@leggedrobotics.com');
        const first = await cliLogin(user);

        const second = await refresh(first.refreshToken);
        expect(second.status).toBe(200);
        expect(second.refreshToken).toBeDefined();
        expect(second.refreshToken).not.toBe(first.refreshToken);

        // a parallel refresh with the previous token gets the same new token
        const parallel = await refresh(first.refreshToken);
        expect(parallel.status).toBe(200);
        expect(parallel.refreshToken).toBe(second.refreshToken);

        // after the grace period the previous token counts as stolen
        await database
            .getRepository(SessionEntity)
            .update(
                { uuid: sessionUuidOf(first.authToken) },
                { rotatedAt: new Date(Date.now() - 5 * 60 * 1000) },
            );
        expect(await refreshStatus(first.refreshToken)).toBe(401);

        // ... which ends the whole session
        expect(await refreshStatus(second.refreshToken ?? '')).toBe(401);
        expect(await me(second.authToken ?? '')).toBe(401);
    });

    test('should not rotate for CLI versions that cannot store a new token', async () => {
        const user = await newUser('session-old-cli@leggedrobotics.com');
        const tokens = await cliLogin(user);

        const result = await refresh(tokens.refreshToken, '0.66.0');
        expect(result.status).toBe(200);
        expect(result.refreshToken).toBeUndefined();
        expect(await refreshStatus(tokens.refreshToken, '0.66.0')).toBe(200);
    });

    test('should end a session at once when the user signs it out', async () => {
        const user = await newUser('session-revoke@leggedrobotics.com');
        const robot = await cliLogin(user);
        const laptop = await cliLogin(user);

        const response = await fetch(
            `${DEFAULT_URL}/users/me/sessions/${sessionUuidOf(robot.authToken)}`,
            {
                method: 'DELETE',
                headers: {
                    ...getAuthHeaders(),
                    cookie: `authtoken=${laptop.authToken}`,
                },
            },
        );
        expect(response.status).toBe(200);

        expect(await me(robot.authToken)).toBe(401);
        expect(await refreshStatus(robot.refreshToken)).toBe(401);
        expect(await me(laptop.authToken)).toBe(200);
    });

    test('should not let a user sign out sessions of someone else', async () => {
        const owner = await newUser('session-owner@leggedrobotics.com');
        const other = await newUser('session-other@leggedrobotics.com');
        const ownerTokens = await cliLogin(owner);
        const otherTokens = await cliLogin(other);

        const response = await fetch(
            `${DEFAULT_URL}/users/me/sessions/${sessionUuidOf(ownerTokens.authToken)}`,
            {
                method: 'DELETE',
                headers: {
                    ...getAuthHeaders(),
                    cookie: `authtoken=${otherTokens.authToken}`,
                },
            },
        );
        expect(response.status).toBe(404);
        expect(await me(ownerTokens.authToken)).toBe(200);
    });

    test('should end the session on logout', async () => {
        const user = await newUser('session-logout@leggedrobotics.com');
        const tokens = await cliLogin(user);

        const response = await fetch(`${DEFAULT_URL}/auth/logout`, {
            method: 'POST',
            headers: { cookie: `refreshtoken=${tokens.refreshToken}` },
        });
        expect(response.status).toBe(200);
        expect(await me(tokens.authToken)).toBe(401);
    });

    test('should sign out all other sessions but keep the current one', async () => {
        const user = await newUser('session-others@leggedrobotics.com');
        const keep = await cliLogin(user);
        const other = await cliLogin(user);

        const response = await fetch(
            `${DEFAULT_URL}/users/me/sessions/revoke-others`,
            {
                method: 'POST',
                headers: {
                    ...getAuthHeaders(),
                    cookie: `authtoken=${keep.authToken}`,
                },
            },
        );
        expect(response.status).toBe(200);
        expect(await me(keep.authToken)).toBe(200);
        expect(await me(other.authToken)).toBe(401);
    });

    test('should let only admins sign out all sessions of a user', async () => {
        const admin = await newUser(
            'session-admin@leggedrobotics.com',
            UserRole.ADMIN,
        );
        const user = await newUser('session-leaver@leggedrobotics.com');
        const tokens = await cliLogin(user);

        const asUser = await fetch(
            `${DEFAULT_URL}/users/${user.uuid}/sessions/revoke`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(asUser.status).not.toBe(200);
        expect(await me(tokens.authToken)).toBe(200);

        const asAdmin = await fetch(
            `${DEFAULT_URL}/users/${user.uuid}/sessions/revoke`,
            { method: 'POST', headers: getAuthHeaders(admin) },
        );
        expect(asAdmin.status).toBe(200);
        expect(await me(tokens.authToken)).toBe(401);
    });

    test('should end a session that was not used for too long', async () => {
        const user = await newUser('session-idle@leggedrobotics.com');
        const tokens = await cliLogin(user);

        await database
            .getRepository(SessionEntity)
            .update(
                { uuid: sessionUuidOf(tokens.authToken) },
                { lastUsedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
            );
        expect(await refreshStatus(tokens.refreshToken)).toBe(401);
        expect(await me(tokens.authToken)).toBe(401);
    });

    test('should keep accepting refresh tokens from before sessions', async () => {
        const user = await newUser('session-legacy@leggedrobotics.com');
        const legacy = jwt.sign(
            { uuid: user.uuid },
            process.env.JWT_SECRET ?? '',
            { expiresIn: '7d' },
        );

        const result = await refresh(legacy);
        expect(result.status).toBe(200);
        expect(result.refreshToken).toBeUndefined();
        expect(await me(result.authToken ?? '')).toBe(200);
    });
});
