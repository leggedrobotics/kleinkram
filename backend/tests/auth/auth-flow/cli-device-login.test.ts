import type {
    CliConfigDto,
    DeviceAuthorizationDto,
    DeviceAuthorizationInfoDto,
    DeviceTokenDto,
} from '@kleinkram/api-dto';
import { UserRole } from '@kleinkram/shared';
import jwt from 'jsonwebtoken';
import { getAuthHeaders } from '../../utils/api-calls';
import {
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const startLogin = async (): Promise<DeviceAuthorizationDto> => {
    const response = await fetch(`${DEFAULT_URL}/cli/device`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), ...JSON_HEADERS },
        body: JSON.stringify({
            hostname: 'anymal-d-042',
            platform: 'Linux x86_64',
            cliVersion: '0.67.0',
        }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as DeviceAuthorizationDto;
};

const poll = async (deviceCode: string): Promise<DeviceTokenDto> => {
    const response = await fetch(`${DEFAULT_URL}/cli/device/token`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), ...JSON_HEADERS },
        body: JSON.stringify({ deviceCode }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as DeviceTokenDto;
};

describe('CLI Device Login', () => {
    setupDatabaseHooks();

    test('should describe the instance without login or client version', async () => {
        const response = await fetch(`${DEFAULT_URL}/cli/config`);
        expect(response.status).toBe(200);

        const config = (await response.json()) as CliConfigDto;
        expect(config.apiUrl).toBeTruthy();
        expect(config.frontendUrl).toBeTruthy();
        expect(config.s3Url).toMatch(/^https?:\/\//);
        expect(config.minCliVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(config.deviceFlow).toBe(true);
    });

    test('should hand out tokens once after the user approves the code', async () => {
        const userId = await mockDatabaseUser(
            'device-login@leggedrobotics.com',
            'Device Login User',
            UserRole.USER,
        );
        const user = await getUserFromDatabase(userId);

        const authorization = await startLogin();
        expect(authorization.userCode).toMatch(/^[A-Z]{4}-[A-Z]{4}$/);
        expect(authorization.verificationUriComplete).toContain(
            `/cli/activate?code=${authorization.userCode}`,
        );

        expect((await poll(authorization.deviceCode)).status).toBe('pending');

        // the approval page shows the machine
        const info = await fetch(
            `${DEFAULT_URL}/cli/device/${authorization.userCode.toLowerCase()}`,
            { headers: getAuthHeaders(user) },
        );
        expect(info.status).toBe(200);
        const infoBody = (await info.json()) as DeviceAuthorizationInfoDto;
        expect(infoBody.status).toBe('pending');
        expect(infoBody.hostname).toBe('anymal-d-042');

        const approve = await fetch(
            `${DEFAULT_URL}/cli/device/${authorization.userCode}/approve`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(approve.status).toBe(200);

        const tokens = await poll(authorization.deviceCode);
        expect(tokens.status).toBe('approved');
        const payload = jwt.decode(tokens.authToken ?? '') as {
            uuid: string;
        };
        expect(payload.uuid).toBe(user.uuid);

        // the tokens work
        const me = await fetch(`${DEFAULT_URL}/users/me`, {
            headers: {
                ...getAuthHeaders(),
                cookie: `authtoken=${tokens.authToken ?? ''}`,
            },
        });
        expect(me.status).toBe(200);

        // and are handed out only once
        expect((await poll(authorization.deviceCode)).status).toBe('expired');
    });

    test('should report a denied login to the CLI', async () => {
        const userId = await mockDatabaseUser(
            'device-deny@leggedrobotics.com',
            'Device Deny User',
            UserRole.USER,
        );
        const user = await getUserFromDatabase(userId);

        const authorization = await startLogin();
        const deny = await fetch(
            `${DEFAULT_URL}/cli/device/${authorization.userCode}/deny`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(deny.status).toBe(200);

        // a decided login cannot be approved afterwards
        const approve = await fetch(
            `${DEFAULT_URL}/cli/device/${authorization.userCode}/approve`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(approve.status).toBe(400);

        expect((await poll(authorization.deviceCode)).status).toBe('denied');
    });

    test('should require a signed in user to approve a code', async () => {
        const authorization = await startLogin();
        const approve = await fetch(
            `${DEFAULT_URL}/cli/device/${authorization.userCode}/approve`,
            { method: 'POST', headers: getAuthHeaders() },
        );
        expect(approve.status).toBe(401);
        expect((await poll(authorization.deviceCode)).status).toBe('pending');
    });

    test('should return 404 for an unknown code', async () => {
        const userId = await mockDatabaseUser(
            'device-unknown@leggedrobotics.com',
            'Device Unknown User',
            UserRole.USER,
        );
        const user = await getUserFromDatabase(userId);
        const response = await fetch(`${DEFAULT_URL}/cli/device/BBBB-CCCC`, {
            headers: getAuthHeaders(user),
        });
        expect(response.status).toBe(404);
    });

    test('should report an unknown device code as expired', async () => {
        expect((await poll('not-a-real-device-code')).status).toBe('expired');
    });
});
