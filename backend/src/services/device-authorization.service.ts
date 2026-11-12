import { AuthService } from '@/services/auth.service';
import {
    CreateDeviceAuthorizationDto,
    DeviceAuthorizationDto,
    DeviceAuthorizationInfoDto,
    DeviceAuthorizationState,
    DeviceTokenDto,
} from '@kleinkram/api-dto';
import { redis as redisConfig } from '@kleinkram/backend-common/consts';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { CookieNames } from '@kleinkram/shared';
import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    Injectable,
    NotFoundException,
    OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Redis } from 'ioredis';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { Repository } from 'typeorm';

/** How long a device login can wait for approval. */
export const DEVICE_CODE_TTL_SECONDS = 10 * 60;

/** Seconds the CLI waits between two polls. */
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

/**
 * Logins that can be started per minute on the whole instance. The endpoint
 * needs no login, so this bounds what anonymous callers can store in Redis:
 * at most `limit * TTL / 60` pending logins exist at any time.
 */
export const DEVICE_LOGINS_PER_MINUTE = 60;

/**
 * Consonants only (as GitHub does): no vowels, so a code never spells a
 * word, and no letters that are easy to confuse.
 */
const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const USER_CODE_LENGTH = 8;

const KEY_PREFIX = 'cli-device';

const hashDeviceCode = (deviceCode: string): string =>
    createHash('sha256').update(deviceCode).digest('hex');

const deviceKey = (deviceCodeHash: string): string =>
    `${KEY_PREFIX}:device:${deviceCodeHash}`;

const userCodeKey = (userCode: string): string =>
    `${KEY_PREFIX}:user-code:${userCode}`;

const rateKey = (minute: number): string =>
    `${KEY_PREFIX}:created:${String(minute)}`;

/**
 * Sets the decision on a pending login, atomically.
 *
 * Returns the stored fields after the change, `{'missing'}` when the login
 * does not exist (any more), or `{'decided', status}` when it was already
 * decided. Never creates a key, so a late decision cannot bring back a login
 * whose tokens were already collected.
 *
 * KEYS[1] device key, ARGV[1] new status, ARGV[2] user uuid ('' for none)
 */
const DECIDE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
    return {'missing'}
end
local status = redis.call('HGET', KEYS[1], 'status')
if status ~= 'pending' then
    return {'decided', status}
end
redis.call('HSET', KEYS[1], 'status', ARGV[1])
if ARGV[2] ~= '' then
    redis.call('HSET', KEYS[1], 'userUuid', ARGV[2])
end
return redis.call('HGETALL', KEYS[1])
`;

/**
 * One poll by the CLI, atomically.
 *
 * - missing: `{'expired'}`
 * - approved: deletes the login and returns `{'approved', userUuid}`, so
 *   the tokens are handed out exactly once
 * - denied: deletes the login and returns `{'denied'}`
 * - pending: records the poll time and returns `{'pending'}`, or
 *   `{'slow_down'}` when the CLI polls faster than the interval
 *
 * KEYS[1] device key, ARGV[1] now (ms), ARGV[2] minimum gap between polls (ms)
 */
const POLL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
    return {'expired'}
end
local status = redis.call('HGET', KEYS[1], 'status')
if status == 'approved' then
    local userUuid = redis.call('HGET', KEYS[1], 'userUuid')
    local userCode = redis.call('HGET', KEYS[1], 'userCode')
    redis.call('DEL', KEYS[1], '${KEY_PREFIX}:user-code:' .. userCode)
    return {'approved', userUuid}
end
if status == 'denied' then
    local userCode = redis.call('HGET', KEYS[1], 'userCode')
    redis.call('DEL', KEYS[1], '${KEY_PREFIX}:user-code:' .. userCode)
    return {'denied'}
end
local last = tonumber(redis.call('HGET', KEYS[1], 'lastPolledAt') or '0')
local now = tonumber(ARGV[1])
redis.call('HSET', KEYS[1], 'lastPolledAt', ARGV[1])
if now - last < tonumber(ARGV[2]) then
    return {'slow_down'}
end
return {'pending'}
`;

/**
 * Brings a code typed by a person into the stored form `XXXX-XXXX`:
 * upper case, separators ignored.
 */
export const normalizeUserCode = (code: string): string => {
    const letters = code.toUpperCase().replaceAll(/[^A-Z]/g, '');
    return `${letters.slice(0, 4)}-${letters.slice(4)}`;
};

const generateUserCode = (): string => {
    let letters = '';
    for (let index = 0; index < USER_CODE_LENGTH; index++) {
        letters += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)];
    }
    return normalizeUserCode(letters);
};

const pairsToRecord = (pairs: string[]): Record<string, string> => {
    const record: Record<string, string> = {};
    for (let index = 0; index + 1 < pairs.length; index += 2) {
        record[pairs[index] as string] = pairs[index + 1] as string;
    }
    return record;
};

/** fields are stored as '' when the CLI did not send them */
const nonEmpty = (value: string | undefined): string | undefined =>
    value === undefined || value === '' ? undefined : value;

const toInfo = (
    stored: Partial<Record<string, string>>,
): DeviceAuthorizationInfoDto => ({
    userCode: stored.userCode ?? '',
    status: (stored.status ?? 'pending') as DeviceAuthorizationState,
    hostname: nonEmpty(stored.hostname),
    platform: nonEmpty(stored.platform),
    cliVersion: nonEmpty(stored.cliVersion),
    createdAt: new Date(stored.createdAt ?? 0),
    expiresAt: new Date(stored.expiresAt ?? 0),
});

/**
 * Device authorization for the CLI, modelled on OAuth 2.0 device
 * authorization (RFC 8628).
 *
 * 1. The CLI asks for a device code and a user code.
 * 2. The user opens the web app, signs in and approves the user code.
 * 3. The CLI polls with the device code and receives a token pair once.
 *
 * Pending logins are Redis hashes that expire on their own. Only a hash of
 * the device code is stored. Every state change runs as one Lua script, so
 * polls and decisions cannot overwrite each other.
 */
@Injectable()
export class DeviceAuthorizationService implements OnModuleDestroy {
    private readonly redis: Redis;

    constructor(
        private readonly authService: AuthService,
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) {
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

    async create(
        request: CreateDeviceAuthorizationDto,
    ): Promise<DeviceAuthorizationDto> {
        await this.enforceRateLimit();

        const deviceCode = randomBytes(32).toString('base64url');
        const deviceCodeHash = hashDeviceCode(deviceCode);
        const now = new Date();
        const expiresAt = new Date(
            now.getTime() + DEVICE_CODE_TTL_SECONDS * 1000,
        );

        // a collision is astronomically unlikely, but cheap to rule out
        let userCode = generateUserCode();
        for (let attempt = 0; attempt < 5; attempt++) {
            const reserved = await this.redis.set(
                userCodeKey(userCode),
                deviceCodeHash,
                'EX',
                DEVICE_CODE_TTL_SECONDS,
                'NX',
            );
            if (reserved === 'OK') break;
            if (attempt === 4) {
                throw new ConflictException('Could not create a login code');
            }
            userCode = generateUserCode();
        }

        const key = deviceKey(deviceCodeHash);
        await this.redis
            .multi()
            .hset(key, {
                userCode,
                status: 'pending',
                hostname: request.hostname ?? '',
                platform: request.platform ?? '',
                cliVersion: request.cliVersion ?? '',
                createdAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
            })
            .expire(key, DEVICE_CODE_TTL_SECONDS)
            .exec();

        const verificationUri = `${env.FRONTEND_URL}/cli/activate`;
        return {
            deviceCode,
            userCode,
            verificationUri,
            verificationUriComplete: `${verificationUri}?code=${userCode}`,
            expiresIn: DEVICE_CODE_TTL_SECONDS,
            interval: DEVICE_POLL_INTERVAL_SECONDS,
        };
    }

    async info(userCode: string): Promise<DeviceAuthorizationInfoDto> {
        const deviceCodeHash = await this.findDeviceCodeHash(userCode);
        const stored = await this.redis.hgetall(deviceKey(deviceCodeHash));
        if (Object.keys(stored).length === 0) throw this.notFound();
        return toInfo(stored);
    }

    async approve(
        userCode: string,
        userUuid: string,
    ): Promise<DeviceAuthorizationInfoDto> {
        return this.decide(userCode, 'approved', userUuid);
    }

    async deny(userCode: string): Promise<DeviceAuthorizationInfoDto> {
        return this.decide(userCode, 'denied');
    }

    /**
     * Called by the CLI. Returns the tokens exactly once after approval;
     * the login is deleted at that point.
     */
    async poll(deviceCode: string): Promise<DeviceTokenDto> {
        const result = (await this.redis.eval(
            POLL_SCRIPT,
            1,
            deviceKey(hashDeviceCode(deviceCode)),
            String(Date.now()),
            String((DEVICE_POLL_INTERVAL_SECONDS - 1) * 1000),
        )) as string[];

        const [status, userUuid] = result;
        if (status === 'approved' && userUuid) {
            const user = await this.userRepository.findOne({
                where: { uuid: userUuid },
            });
            if (user === null) return { status: 'denied' };

            const tokens = this.authService.login(user);
            return {
                status: 'approved',
                authToken: tokens[CookieNames.AUTH_TOKEN],
                refreshToken: tokens[CookieNames.REFRESH_TOKEN],
            };
        }
        if (
            status === 'pending' ||
            status === 'slow_down' ||
            status === 'denied'
        ) {
            return { status };
        }
        return { status: 'expired' };
    }

    private async decide(
        userCode: string,
        status: 'approved' | 'denied',
        userUuid?: string,
    ): Promise<DeviceAuthorizationInfoDto> {
        const deviceCodeHash = await this.findDeviceCodeHash(userCode);
        const result = (await this.redis.eval(
            DECIDE_SCRIPT,
            1,
            deviceKey(deviceCodeHash),
            status,
            userUuid ?? '',
        )) as string[];

        if (result[0] === 'missing') throw this.notFound();
        if (result[0] === 'decided') {
            throw new BadRequestException(
                `This login was already ${result[1] ?? 'decided'}.`,
            );
        }
        // the response is built from the decided record itself, so it does
        // not depend on the CLI not having collected its tokens yet
        return toInfo(pairsToRecord(result));
    }

    private async findDeviceCodeHash(userCode: string): Promise<string> {
        const deviceCodeHash = await this.redis.get(
            userCodeKey(normalizeUserCode(userCode)),
        );
        if (deviceCodeHash === null) throw this.notFound();
        return deviceCodeHash;
    }

    private async enforceRateLimit(): Promise<void> {
        const key = rateKey(Math.floor(Date.now() / 60_000));
        const [[, count]] = (await this.redis
            .multi()
            .incr(key)
            .expire(key, 120)
            .exec()) as [[Error | null, number], [Error | null, number]];
        if (count > DEVICE_LOGINS_PER_MINUTE) {
            throw new HttpException(
                'Too many CLI logins were started. Please try again in a minute.',
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
    }

    private notFound(): NotFoundException {
        return new NotFoundException(
            'This code is unknown or has expired. Run `klein login` again to get a new one.',
        );
    }
}
