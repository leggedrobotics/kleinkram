import { SessionDto } from '@kleinkram/api-dto';
import { SessionEntity } from '@kleinkram/backend-common/entities/auth/session.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { CookieNames, SessionKind } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { IsNull, Not, Repository } from 'typeorm';
import logger from '../logger';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a session lasts: without use (idle) and at most (absolute). */
export const SESSION_LIFETIMES: Record<
    SessionKind,
    { idleMs: number; absoluteMs: number }
> = {
    [SessionKind.WEB]: { idleMs: 7 * DAY_MS, absoluteMs: 30 * DAY_MS },
    [SessionKind.CLI]: { idleMs: 30 * DAY_MS, absoluteMs: 90 * DAY_MS },
};

/** Lifetime of an access token. */
export const ACCESS_TOKEN_LIFETIME = '30m';

/**
 * How long the previous refresh token keeps working after a rotation.
 * Covers parallel refreshes (several tabs, several `klein` processes) and a
 * response lost on the network; they get the current token instead.
 */
export const ROTATION_GRACE_MS = 60 * 1000;

/** CLI versions before this one cannot store a rotated refresh token. */
const FIRST_ROTATING_CLI_VERSION: [number, number, number] = [0, 67, 0];

/** Ended sessions are deleted after this time. */
const KEEP_ENDED_SESSIONS_MS = 30 * DAY_MS;

const TOKEN_PREFIX = 'ks1';

export type SessionRevokeReason = 'logout' | 'user' | 'admin' | 'reuse';

export interface SessionClient {
    kind: SessionKind;
    name?: string | undefined;
    platform?: string | undefined;
    clientVersion?: string | undefined;
}

export interface SessionTokens {
    [CookieNames.AUTH_TOKEN]: string;
    [CookieNames.REFRESH_TOKEN]: string;
}

export interface RefreshResult {
    session: SessionEntity;
    tokens: SessionTokens;
    /** whether a new refresh token was issued */
    rotated: boolean;
}

export class InvalidSessionError extends Error {}

/** Payload of an access token. `sid` is missing in tokens from before sessions. */
export interface AccessTokenPayload {
    uuid: string;
    sid?: string;
}

const parseVersion = (version: string | undefined): number[] | undefined => {
    const match = version?.match(/^(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1, 4).map(Number) : undefined;
};

const isOlderThan = (
    version: number[],
    other: [number, number, number],
): boolean => {
    for (let index = 0; index < 3; index++) {
        const a = version[index] ?? 0;
        const b = other[index];
        if (a !== b) return a < b;
    }
    return false;
};

/**
 * Whether a client stores rotated refresh tokens: the web app always (it is a
 * cookie), the CLI from 0.67 on.
 */
const supportsRotation = (
    kind: SessionKind,
    clientVersion: string | undefined,
): boolean => {
    if (kind !== SessionKind.CLI) return true;
    const version = parseVersion(clientVersion);
    return (
        version !== undefined &&
        !isOlderThan(version, FIRST_ROTATING_CLI_VERSION)
    );
};

/** When the session ends if nobody uses it: idle or absolute limit. */
export const sessionEndsAt = (session: SessionEntity): Date => {
    const idleEnd =
        session.lastUsedAt.getTime() + SESSION_LIFETIMES[session.kind].idleMs;
    return new Date(Math.min(idleEnd, session.expiresAt.getTime()));
};

export const isSessionActive = (
    session: SessionEntity,
    now = new Date(),
): boolean =>
    (session.revokedAt === null || session.revokedAt === undefined) &&
    now < sessionEndsAt(session);

/**
 * A short description of the browser from its User-Agent, e.g.
 * `{ name: 'Firefox', platform: 'Linux' }`. Only shown to the user, never
 * used for decisions.
 */
export const describeBrowser = (
    userAgent: string | undefined,
): { name?: string; platform?: string } => {
    if (!userAgent) return {};
    const browsers: [RegExp, string][] = [
        [/Edg\//, 'Edge'],
        [/OPR\//, 'Opera'],
        [/Firefox\//, 'Firefox'],
        [/Chrome\//, 'Chrome'],
        [/Safari\//, 'Safari'],
    ];
    const platforms: [RegExp, string][] = [
        [/Android/, 'Android'],
        [/iPhone|iPad/, 'iOS'],
        [/Windows/, 'Windows'],
        [/Mac OS X|Macintosh/, 'macOS'],
        [/Linux/, 'Linux'],
    ];
    const name = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
    const platform = platforms.find(([pattern]) =>
        pattern.test(userAgent),
    )?.[1];
    return { name, platform };
};

/**
 * Login sessions for the web app and the CLI.
 *
 * Refresh tokens look like `ks1.<session>.<generation>.<mac>`, where `mac`
 * is an HMAC over session, generation and the session's secret. Nothing
 * secret about a token is stored, yet the server can compute the current
 * token of a session again, which lets parallel refreshes within the grace
 * period agree on one new token instead of being taken for theft.
 *
 * Presenting a refresh token older than the previous one (or the previous
 * one after the grace period) means it was copied: the session ends
 * (refresh token rotation with reuse detection, RFC 9700 section 4.14).
 */
@Injectable()
export class SessionService {
    constructor(
        @InjectRepository(SessionEntity)
        private readonly sessionRepository: Repository<SessionEntity>,
        private readonly jwtService: JwtService,
    ) {}

    async create(
        user: Pick<UserEntity, 'uuid'>,
        client: SessionClient,
    ): Promise<{ session: SessionEntity; tokens: SessionTokens }> {
        const now = new Date();
        const secret = randomBytes(32).toString('base64url');
        const session = await this.sessionRepository.save(
            this.sessionRepository.create({
                userUuid: user.uuid,
                kind: client.kind,
                name: client.name?.slice(0, 255) ?? null,
                platform: client.platform?.slice(0, 255) ?? null,
                clientVersion: client.clientVersion?.slice(0, 64) ?? null,
                lastUsedAt: now,
                expiresAt: new Date(
                    now.getTime() + SESSION_LIFETIMES[client.kind].absoluteMs,
                ),
                generation: 0,
                rotating: supportsRotation(client.kind, client.clientVersion),
                secret,
            }),
        );
        return { session, tokens: this.issueTokens(session, secret) };
    }

    /**
     * Exchanges a refresh token for a new access token (and, where the
     * client supports it, a new refresh token).
     *
     * @param refreshToken - the presented refresh token
     * @param clientVersion - the `kleinkram-client-version` header, if any
     * @throws InvalidSessionError when the token is invalid or the session ended
     */
    async refresh(
        refreshToken: string,
        clientVersion: string | undefined,
    ): Promise<RefreshResult> {
        const parsed = this.parseRefreshToken(refreshToken);
        if (!parsed) throw new InvalidSessionError('Malformed refresh token');

        const session = await this.findWithSecret(parsed.sessionUuid);
        if (!session) throw new InvalidSessionError('Unknown session');
        if (!this.macMatches(session, parsed.generation, parsed.mac)) {
            throw new InvalidSessionError('Invalid refresh token');
        }
        if (!isSessionActive(session)) {
            throw new InvalidSessionError('Session ended');
        }

        const now = new Date();
        const current = session.generation;

        // a client that turns out to store rotated tokens switches the
        // session to rotation for good; there is no way back
        if (
            !session.rotating &&
            supportsRotation(session.kind, clientVersion)
        ) {
            await this.sessionRepository.update(
                { uuid: session.uuid },
                { rotating: true },
            );
            session.rotating = true;
        }

        if (parsed.generation === current) {
            if (!session.rotating) {
                await this.touch(session, now);
                return {
                    session,
                    tokens: this.issueTokens(session, session.secret),
                    rotated: false,
                };
            }
            // several refreshes in quick succession (parallel requests, a
            // second tab) stay on one generation: rotating again within the
            // grace period would turn a still delayed request with the
            // previous token into "reuse" and end a legitimate session
            if (this.rotatedRecently(session, now)) {
                await this.touch(session, now);
                return {
                    session,
                    tokens: this.issueTokens(session, session.secret),
                    rotated: true,
                };
            }
            // only one of several parallel requests wins the rotation; the
            // others continue below as "previous token within grace"
            const result = await this.sessionRepository.update(
                { uuid: session.uuid, generation: current },
                { generation: current + 1, rotatedAt: now, lastUsedAt: now },
            );
            if (result.affected === 1) {
                session.generation = current + 1;
                session.rotatedAt = now;
                session.lastUsedAt = now;
                return {
                    session,
                    tokens: this.issueTokens(session, session.secret),
                    rotated: true,
                };
            }
            const reloaded = await this.findWithSecret(session.uuid);
            if (!reloaded) throw new InvalidSessionError('Unknown session');
            return this.withinGrace(reloaded, parsed.generation, now);
        }

        return this.withinGrace(session, parsed.generation, now);
    }

    /** Ends the session a refresh token belongs to (logout). */
    async revokeByRefreshToken(refreshToken: string): Promise<boolean> {
        const parsed = this.parseRefreshToken(refreshToken);
        if (!parsed) return false;
        const session = await this.findWithSecret(parsed.sessionUuid);
        if (!session) return false;
        if (!this.macMatches(session, parsed.generation, parsed.mac)) {
            return false;
        }
        return this.revoke(session.uuid, 'logout');
    }

    async revoke(
        sessionUuid: string,
        reason: SessionRevokeReason,
        userUuid?: string,
    ): Promise<boolean> {
        const result = await this.sessionRepository.update(
            {
                uuid: sessionUuid,
                revokedAt: IsNull(),
                ...(userUuid === undefined ? {} : { userUuid }),
            },
            { revokedAt: new Date(), revokedReason: reason },
        );
        return (result.affected ?? 0) > 0;
    }

    /** Ends all sessions of a user, except `keepSessionUuid` if given. */
    async revokeAllOfUser(
        userUuid: string,
        reason: SessionRevokeReason,
        keepSessionUuid?: string,
    ): Promise<number> {
        const result = await this.sessionRepository.update(
            {
                userUuid,
                revokedAt: IsNull(),
                ...(keepSessionUuid === undefined
                    ? {}
                    : { uuid: Not(keepSessionUuid) }),
            },
            { revokedAt: new Date(), revokedReason: reason },
        );
        return result.affected ?? 0;
    }

    async listActive(
        userUuid: string,
        currentSessionUuid: string | undefined,
    ): Promise<SessionDto[]> {
        const sessions = await this.sessionRepository.find({
            where: { userUuid, revokedAt: IsNull() },
            order: { lastUsedAt: 'DESC' },
        });
        const now = new Date();
        return sessions
            .filter((session) => isSessionActive(session, now))
            .map((session) => ({
                uuid: session.uuid,
                kind: session.kind,
                name: session.name ?? undefined,
                platform: session.platform ?? undefined,
                clientVersion: session.clientVersion ?? undefined,
                createdAt: session.createdAt,
                lastUsedAt: session.lastUsedAt,
                expiresAt: sessionEndsAt(session),
                current: session.uuid === currentSessionUuid,
            }));
    }

    /**
     * The session an access token names, with its user, if it is still
     * active. Used on every request, so it is a single query.
     */
    async findActiveForAccessToken(
        payload: AccessTokenPayload,
    ): Promise<SessionEntity | null> {
        if (payload.sid === undefined) return null;
        const session = await this.sessionRepository.findOne({
            where: { uuid: payload.sid, revokedAt: IsNull() },
            relations: { user: true },
            select: {
                uuid: true,
                kind: true,
                userUuid: true,
                lastUsedAt: true,
                expiresAt: true,
                revokedAt: true,
                user: { uuid: true, role: true, name: true },
            },
        });
        if (session?.userUuid !== payload.uuid) return null;
        return isSessionActive(session) ? session : null;
    }

    /**
     * Deletes sessions that ended more than 30 days ago: revoked, past their
     * absolute end, or unused for longer than their idle limit.
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async deleteEndedSessions(): Promise<void> {
        const cutoff = Date.now() - KEEP_ENDED_SESSIONS_MS;
        const query = this.sessionRepository
            .createQueryBuilder()
            .delete()
            .where('"revokedAt" < :cutoff', { cutoff: new Date(cutoff) })
            .orWhere('"expiresAt" < :cutoff', { cutoff: new Date(cutoff) });
        for (const kind of Object.values(SessionKind)) {
            query.orWhere(
                `(kind = :kind${kind} AND "lastUsedAt" < :idleCutoff${kind})`,
                {
                    [`kind${kind}`]: kind,
                    [`idleCutoff${kind}`]: new Date(
                        cutoff - SESSION_LIFETIMES[kind].idleMs,
                    ),
                },
            );
        }
        const result = await query.execute();
        const count = result.affected ?? 0;
        if (count > 0) logger.info(`Deleted ${String(count)} ended sessions`);
    }

    private async withinGrace(
        session: SessionEntity,
        presented: number,
        now: Date,
    ): Promise<RefreshResult> {
        const inGrace =
            presented === session.generation - 1 &&
            this.rotatedRecently(session, now);

        if (!inGrace) {
            await this.revoke(session.uuid, 'reuse');
            logger.warn(
                `Refresh token reuse for session ${session.uuid}: session revoked`,
            );
            throw new InvalidSessionError('Refresh token was already used');
        }

        await this.touch(session, now);
        return {
            session,
            tokens: this.issueTokens(session, session.secret),
            rotated: true,
        };
    }

    private rotatedRecently(session: SessionEntity, now: Date): boolean {
        return (
            session.rotatedAt !== null &&
            session.rotatedAt !== undefined &&
            now.getTime() - session.rotatedAt.getTime() <= ROTATION_GRACE_MS
        );
    }

    private async touch(session: SessionEntity, now: Date): Promise<void> {
        session.lastUsedAt = now;
        await this.sessionRepository.update(
            { uuid: session.uuid },
            { lastUsedAt: now },
        );
    }

    private async findWithSecret(
        sessionUuid: string,
    ): Promise<SessionEntity | null> {
        return this.sessionRepository
            .createQueryBuilder('session')
            .addSelect('session.secret')
            .where('session.uuid = :uuid', { uuid: sessionUuid })
            .getOne();
    }

    private issueTokens(session: SessionEntity, secret: string): SessionTokens {
        const payload: AccessTokenPayload = {
            uuid: session.userUuid,
            sid: session.uuid,
        };
        return {
            [CookieNames.AUTH_TOKEN]: this.jwtService.sign(payload, {
                expiresIn: ACCESS_TOKEN_LIFETIME,
            }),
            [CookieNames.REFRESH_TOKEN]: [
                TOKEN_PREFIX,
                session.uuid,
                String(session.generation),
                this.mac(session.uuid, session.generation, secret),
            ].join('.'),
        };
    }

    private mac(sessionUuid: string, generation: number, secret: string) {
        return createHmac('sha256', env.JWT_SECRET)
            .update(`${sessionUuid}.${String(generation)}.${secret}`)
            .digest('base64url');
    }

    private macMatches(
        session: SessionEntity,
        generation: number,
        mac: string,
    ): boolean {
        const expected = Buffer.from(
            this.mac(session.uuid, generation, session.secret),
        );
        const given = Buffer.from(mac);
        return (
            expected.length === given.length && timingSafeEqual(expected, given)
        );
    }

    private parseRefreshToken(
        token: string,
    ): { sessionUuid: string; generation: number; mac: string } | undefined {
        const parts = token.split('.');
        if (parts.length !== 4 || parts[0] !== TOKEN_PREFIX) return undefined;
        const [, sessionUuid, generationText, mac] = parts as [
            string,
            string,
            string,
            string,
        ];
        if (!/^[0-9a-f-]{36}$/.test(sessionUuid)) return undefined;
        if (!/^\d{1,9}$/.test(generationText)) return undefined;
        return {
            sessionUuid,
            generation: Number(generationText),
            mac,
        };
    }
}

/** Claims of a JWT from before sessions existed (refresh or access token). */
export interface LegacyTokenPayload extends AccessTokenPayload {
    iat?: number;
    exp?: number;
}

/** Old refresh tokens lived 7 days, access tokens 30 to 60 minutes. */
const LEGACY_REFRESH_MIN_LIFETIME_S = 24 * 60 * 60;

/**
 * Whether a JWT is a refresh token issued before sessions existed. Such
 * tokens keep working until they expire (at most 7 days after the update).
 */
export const isLegacyRefreshToken = (payload: LegacyTokenPayload): boolean =>
    payload.sid === undefined &&
    payload.iat !== undefined &&
    payload.exp !== undefined &&
    payload.exp - payload.iat >= LEGACY_REFRESH_MIN_LIFETIME_S;

/** Whether a refresh token uses the session format (and not a legacy JWT). */
export const isSessionRefreshToken = (token: string): boolean =>
    token.startsWith(`${TOKEN_PREFIX}.`);
