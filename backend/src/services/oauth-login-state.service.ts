import { AuthFlowException } from '@/types/auth-flow-exception';
import { redis as redisConfig } from '@kleinkram/backend-common/consts';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { StateStore } from 'passport-oauth2';

/**
 * Binds every OAuth login (Google, GitHub, fake-oauth) to the browser that
 * started it, as RFC 6749 section 10.12 and RFC 9700 section 4.7 require.
 *
 * When a login starts, the browser gets a random binding cookie, and Redis
 * keeps a one-time entry under a random `state`: the hash of that cookie, the
 * PKCE code verifier and where the login should end (web app or CLI). The
 * provider only sees the `state` and the PKCE challenge. On the way back the
 * entry is taken out of Redis (so it works once) and only counts if the
 * browser still has the matching cookie. A callback that this browser did
 * not start, with an attacker's authorization code, is refused.
 */

export const OAUTH_LOGIN_COOKIE = 'oauthlogin';

/** how long a started login may take at the provider */
export const OAUTH_LOGIN_TTL_SECONDS = 10 * 60;

const KEY_PREFIX = 'oauth-login';

export const LOGIN_NOT_STARTED_MESSAGE =
    'This login was not started in this browser or took too long. Please log in again.';

const sha256 = (value: string): Buffer =>
    createHash('sha256').update(value).digest();

const stateKey = (state: string): string =>
    `${KEY_PREFIX}:state:${sha256(state).toString('hex')}`;

const randomToken = (): string => randomBytes(32).toString('base64url');

// 32 random bytes in base64url
const TOKEN_PATTERN = /^[\w-]{43}$/;

/**
 * Where a login ends. Logins started by the CLI ask for one with the `state`
 * query parameter when they start; anything else ends in the web app.
 */
export type LoginRoute =
    | { kind: 'web' }
    /** very old CLIs: tokens to http://localhost:8000 */
    | { kind: 'cli-legacy-port' }
    /** tokens to the local callback port of the CLI */
    | { kind: 'cli-port'; port: number }
    /** page that shows the tokens to copy (headless CLI login) */
    | { kind: 'cli-no-redirect' }
    /** fake-oauth login of the CLI without a browser (development) */
    | { kind: 'cli-direct' };

export const parseLoginRoute = (value: unknown): LoginRoute => {
    if (value === 'cli') return { kind: 'cli-legacy-port' };
    if (value === 'cli-no-redirect') return { kind: 'cli-no-redirect' };
    if (value === 'cli-direct') return { kind: 'cli-direct' };
    if (typeof value === 'string') {
        const match = /^cli-port-(\d{1,5})$/.exec(value);
        const port = match ? Number.parseInt(match[1], 10) : NaN;
        if (port >= 1 && port <= 65_535) return { kind: 'cli-port', port };
    }
    return { kind: 'web' };
};

interface StoredLogin {
    /** sha256 of the binding cookie, hex */
    binding: string;
    verifier: string;
    route: LoginRoute;
}

/** the route of a login whose callback passed the check */
const verifiedRoutes = new WeakMap<Request, LoginRoute>();

export const loginRouteOf = (request: Request): LoginRoute =>
    verifiedRoutes.get(request) ?? { kind: 'web' };

const toError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

type StoreCallback = (error: Error | null, state?: string) => void;
type VerifyCallback = (
    error: Error | null,
    verifier?: string | false,
    info?: unknown,
) => void;

/**
 * The state store passport-oauth2 calls when PKCE is on. Its typings only
 * describe the forms without PKCE, so `store` below is cast once.
 */
interface PkceStateStore {
    store(
        request: Request,
        verifier: string,
        appState: unknown,
        meta: unknown,
        callback: StoreCallback,
    ): void;
    verify(
        request: Request,
        providedState: unknown,
        callback: VerifyCallback,
    ): void;
}

@Injectable()
export class OAuthLoginStateService implements OnModuleDestroy {
    private readonly redis: Redis;

    /**
     * Pass as `store` together with `pkce: true` to an OAuth2 strategy.
     * passport-oauth2 picks the call form by the number of parameters, so
     * these keep exactly five and three.
     */
    readonly store: StateStore = this.createStore() as unknown as StateStore;

    private createStore(): PkceStateStore {
        // passport expects callbacks; each is called exactly once
        return {
            store: (request, verifier, appState, _meta, callback) => {
                void (async () => {
                    let state: string;
                    try {
                        state = await this.start(request, verifier, appState);
                    } catch (error) {
                        callback(toError(error));
                        return;
                    }
                    callback(null, state);
                })();
            },
            verify: (request, providedState, callback) => {
                void (async () => {
                    let stored: StoredLogin;
                    try {
                        stored = await this.finish(request, providedState);
                    } catch (error) {
                        callback(toError(error));
                        return;
                    }
                    callback(null, stored.verifier);
                })();
            },
        };
    }

    constructor() {
        this.redis = new Redis({
            ...redisConfig,
            lazyConnect: true,
            maxRetriesPerRequest: 3,
        });
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit().catch(() => {
            // already disconnected
        });
    }

    private async start(
        request: Request,
        verifier: string,
        appState: unknown,
    ): Promise<string> {
        // one binding cookie per browser: logins started in two tabs at the
        // same time share it, each with its own state
        const existing: unknown = request.cookies[OAUTH_LOGIN_COOKIE];
        const binding =
            typeof existing === 'string' && TOKEN_PATTERN.test(existing)
                ? existing
                : randomToken();

        const state = randomToken();
        const stored: StoredLogin = {
            binding: sha256(binding).toString('hex'),
            verifier,
            route: (appState as { route?: LoginRoute } | undefined)?.route ?? {
                kind: 'web',
            },
        };
        await this.redis.set(
            stateKey(state),
            JSON.stringify(stored),
            'EX',
            OAUTH_LOGIN_TTL_SECONDS,
        );

        request.res?.cookie(OAUTH_LOGIN_COOKIE, binding, {
            httpOnly: true,
            secure: true,
            // the way back from the provider is a cross-site navigation:
            // `strict` would not send the cookie with it
            sameSite: 'lax',
            path: '/auth',
            maxAge: OAUTH_LOGIN_TTL_SECONDS * 1000,
        });
        return state;
    }

    private async finish(
        request: Request,
        providedState: unknown,
    ): Promise<StoredLogin> {
        if (typeof providedState !== 'string' || providedState === '') {
            throw new AuthFlowException(LOGIN_NOT_STARTED_MESSAGE);
        }

        // take the entry out, so each login can finish only once
        const key = stateKey(providedState);
        const result = await this.redis.multi().get(key).del(key).exec();
        const raw = result?.[0]?.[1];
        if (typeof raw !== 'string') {
            throw new AuthFlowException(LOGIN_NOT_STARTED_MESSAGE);
        }
        const stored = JSON.parse(raw) as StoredLogin;

        const cookie: unknown = request.cookies[OAUTH_LOGIN_COOKIE];
        if (
            typeof cookie !== 'string' ||
            !timingSafeEqual(sha256(cookie), Buffer.from(stored.binding, 'hex'))
        ) {
            throw new AuthFlowException(LOGIN_NOT_STARTED_MESSAGE);
        }

        verifiedRoutes.set(request, stored.route);
        return stored;
    }
}

/**
 * What the strategies pass to passport when a login starts: an object (not
 * a string), so passport stores it with the state store instead of sending
 * it to the provider as the `state`.
 */
export const loginStateOptions = (request: Request): { route: LoginRoute } => ({
    route: parseLoginRoute(request.query.state),
});
