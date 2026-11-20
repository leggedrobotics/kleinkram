import {
    AccessGroupEntity,
    AffiliationGroupService,
    GroupMembershipEntity,
    loadAccessConfig,
} from '@kleinkram/backend-common';
import { SessionEntity } from '@kleinkram/backend-common/entities/auth/session.entity';
import { CookieNames } from '@kleinkram/shared';
import {
    database,
    DEV_ACCESS_CONFIG_PATH,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';
import { DEFAULT_URL } from '../utilities';

/**
 * Login CSRF (RFC 6749 section 10.12, RFC 9700 section 4.7): an OAuth
 * callback may only sign in the browser that started this login. An attacker
 * can get an authorization code for their own account and make a victim's
 * browser open the callback with it.
 *
 * fake-oauth hands out `fake-auth-code-<user id>`, so the tests can play
 * both the attacker (who holds a code) and the victim's browser.
 */

const ATTACKER_CODE = 'fake-auth-code-3';
const VICTIM_CODE = 'fake-auth-code-2';
const CLI_PORT = 45_678;

interface StartedLogin {
    /** cookies the API set when the login started */
    cookies: string;
    /** the state the API sent to the provider, if any */
    state: string | undefined;
}

const cookiePairs = (response: Response): string[] =>
    response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0] ?? '')
        .filter((pair) => !pair.endsWith('='));

const setsLoginCookies = (response: Response): boolean =>
    cookiePairs(response).some(
        (pair) =>
            pair.startsWith(`${CookieNames.AUTH_TOKEN}=`) ||
            pair.startsWith(`${CookieNames.REFRESH_TOKEN}=`),
    );

/**
 * starts a login like a browser does and stops at the provider; `cookies`
 * are the ones the browser already has (a login started in another tab)
 */
const startLogin = async (
    state?: string,
    cookies?: string,
): Promise<StartedLogin> => {
    const query = state === undefined ? '' : `?state=${state}`;
    const response = await fetch(`${DEFAULT_URL}/auth/fake-oauth${query}`, {
        redirect: 'manual',
        headers: cookies ? { cookie: cookies } : {},
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location') ?? '');
    return {
        cookies: cookiePairs(response).join('; ') || (cookies ?? ''),
        state: location.searchParams.get('state') ?? undefined,
    };
};

/** what the provider (or an attacker's link) makes the browser open */
const openCallback = (
    code: string,
    state?: string,
    cookies?: string,
): Promise<Response> => {
    const parameters = new URLSearchParams({ code });
    if (state !== undefined) parameters.set('state', state);
    return fetch(
        `${DEFAULT_URL}/auth/fake-oauth/callback?${parameters.toString()}`,
        {
            redirect: 'manual',
            headers: cookies ? { cookie: cookies } : {},
        },
    );
};

const sessionCount = () => database.getRepository(SessionEntity).count();

describe('OAuth Login CSRF', () => {
    setupDatabaseHooks();

    // the API creates the access groups of access_config.dev.json at start;
    // every test clears the database, and internal users need them
    beforeEach(async () => {
        const affiliationGroupService = new AffiliationGroupService(
            database.getRepository(AccessGroupEntity),
            database.getRepository(GroupMembershipEntity),
        );
        await affiliationGroupService.upsertAccessGroups(
            loadAccessConfig(DEV_ACCESS_CONFIG_PATH),
        );
        await affiliationGroupService.createPublicAccessGroup();
    });

    describe('a callback the browser did not start', () => {
        test('should not log the browser in', async () => {
            const sessionsBefore = await sessionCount();

            const response = await openCallback(ATTACKER_CODE);

            expect(setsLoginCookies(response)).toBe(false);
            expect(response.headers.get('location') ?? '').not.toContain(
                '/landing',
            );
            expect(await sessionCount()).toBe(sessionsBefore);
        });

        test('should not log the browser in with a state it made up', async () => {
            const response = await openCallback(ATTACKER_CODE, 'anything');

            expect(setsLoginCookies(response)).toBe(false);
        });

        test('should not send tokens to a local CLI port', async () => {
            const response = await openCallback(
                ATTACKER_CODE,
                `cli-port-${String(CLI_PORT)}`,
            );

            expect(response.headers.get('location') ?? '').not.toContain(
                `${CookieNames.AUTH_TOKEN}=`,
            );
        });

        test('should not show tokens on the token page', async () => {
            const sessionsBefore = await sessionCount();

            const response = await openCallback(
                ATTACKER_CODE,
                'cli-no-redirect',
            );

            expect(await response.text()).not.toContain('Refresh Token');
            expect(await sessionCount()).toBe(sessionsBefore);
        });

        test("should not accept the state of another browser's login", async () => {
            // the attacker starts a login, keeps its state and sends it along
            const attackerLogin = await startLogin();

            const response = await openCallback(
                ATTACKER_CODE,
                attackerLogin.state ?? 'anything',
            );

            expect(setsLoginCookies(response)).toBe(false);
        });
    });

    describe('a callback the browser started', () => {
        test('should log the browser in', async () => {
            const login = await startLogin();

            const response = await openCallback(
                VICTIM_CODE,
                login.state,
                login.cookies,
            );

            expect(response.status).toBe(302);
            expect(response.headers.get('location') ?? '').toContain(
                '/landing',
            );
            expect(setsLoginCookies(response)).toBe(true);
        });

        test('should send the tokens to the local port of a CLI login', async () => {
            const login = await startLogin(`cli-port-${String(CLI_PORT)}`);

            const response = await openCallback(
                VICTIM_CODE,
                login.state,
                login.cookies,
            );

            const location = response.headers.get('location') ?? '';
            expect(location).toContain(
                `http://localhost:${String(CLI_PORT)}/cli/callback`,
            );
            expect(location).toContain(`${CookieNames.AUTH_TOKEN}=`);
        });

        test('should send PKCE and no CLI routing to the provider', async () => {
            const response = await fetch(
                `${DEFAULT_URL}/auth/fake-oauth?state=cli-port-${String(CLI_PORT)}`,
                { redirect: 'manual' },
            );
            const location = new URL(response.headers.get('location') ?? '');

            expect(location.searchParams.get('code_challenge_method')).toBe(
                'S256',
            );
            expect(location.searchParams.get('code_challenge')).toBeTruthy();
            expect(location.searchParams.get('state')).not.toContain('cli');
        });

        test('should accept a login only once', async () => {
            const login = await startLogin();
            const first = await openCallback(
                VICTIM_CODE,
                login.state,
                login.cookies,
            );
            expect(setsLoginCookies(first)).toBe(true);

            // the same callback again, e.g. from the browser history
            const replay = await openCallback(
                VICTIM_CODE,
                login.state,
                login.cookies,
            );
            expect(setsLoginCookies(replay)).toBe(false);
        });

        test('should finish two logins started in two tabs of the same browser', async () => {
            const firstTab = await startLogin();
            const secondTab = await startLogin(undefined, firstTab.cookies);

            const second = await openCallback(
                VICTIM_CODE,
                secondTab.state,
                secondTab.cookies,
            );
            const first = await openCallback(
                VICTIM_CODE,
                firstTab.state,
                firstTab.cookies,
            );

            expect(setsLoginCookies(second)).toBe(true);
            expect(setsLoginCookies(first)).toBe(true);
        });
    });

    test("should refuse a login with the state of another browser's login", async () => {
        // the attacker starts a login in their browser and sends the state
        // along with their code; the victim's browser has its own login
        const attackerLogin = await startLogin();
        const victimLogin = await startLogin();

        const response = await openCallback(
            ATTACKER_CODE,
            attackerLogin.state,
            victimLogin.cookies,
        );

        expect(setsLoginCookies(response)).toBe(false);
        expect(response.headers.get('location') ?? '').toContain(
            '/login?error_state=auth_flow_failed',
        );
    });
});
