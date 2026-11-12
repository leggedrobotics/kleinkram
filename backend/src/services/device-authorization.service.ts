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
 * Consonants only (as GitHub does): no vowels, so a code never spells a
 * word, and no letters that are easy to confuse.
 */
const USER_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
const USER_CODE_LENGTH = 8;

const KEY_PREFIX = 'cli-device';

interface StoredDeviceAuthorization {
    userCode: string;
    status: DeviceAuthorizationState;
    hostname?: string;
    platform?: string;
    cliVersion?: string;
    ipAddress: string;
    createdAt: string;
    expiresAt: string;
    lastPolledAt?: string;
    userUuid?: string;
}

const hashDeviceCode = (deviceCode: string): string =>
    createHash('sha256').update(deviceCode).digest('hex');

const deviceKey = (deviceCodeHash: string): string =>
    `${KEY_PREFIX}:device:${deviceCodeHash}`;

const userCodeKey = (userCode: string): string =>
    `${KEY_PREFIX}:user-code:${userCode}`;

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

/**
 * Device authorization for the CLI, modelled on OAuth 2.0 device
 * authorization (RFC 8628).
 *
 * 1. The CLI asks for a device code and a user code.
 * 2. The user opens the web app, signs in and approves the user code.
 * 3. The CLI polls with the device code and receives a token pair once.
 *
 * Pending logins live in Redis and expire on their own. Only a hash of the
 * device code is stored.
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
        ipAddress: string,
    ): Promise<DeviceAuthorizationDto> {
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

        const stored: StoredDeviceAuthorization = {
            userCode,
            status: 'pending',
            hostname: request.hostname,
            platform: request.platform,
            cliVersion: request.cliVersion,
            ipAddress,
            createdAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        await this.redis.set(
            deviceKey(deviceCodeHash),
            JSON.stringify(stored),
            'EX',
            DEVICE_CODE_TTL_SECONDS,
        );

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
        const { stored } = await this.findByUserCode(userCode);
        return {
            userCode: stored.userCode,
            status: stored.status,
            hostname: stored.hostname,
            platform: stored.platform,
            cliVersion: stored.cliVersion,
            ipAddress: stored.ipAddress,
            createdAt: new Date(stored.createdAt),
            expiresAt: new Date(stored.expiresAt),
        };
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
        const deviceCodeHash = hashDeviceCode(deviceCode);
        const key = deviceKey(deviceCodeHash);
        const raw = await this.redis.get(key);
        if (raw === null) return { status: 'expired' };

        const stored = JSON.parse(raw) as StoredDeviceAuthorization;

        if (stored.status === 'denied') {
            await this.remove(deviceCodeHash, stored.userCode);
            return { status: 'denied' };
        }

        if (stored.status === 'approved' && stored.userUuid !== undefined) {
            // GETDEL makes sure two concurrent polls cannot both get tokens
            const claimed = await this.redis.getdel(key);
            if (claimed === null) return { status: 'expired' };
            await this.redis.del(userCodeKey(stored.userCode));

            const user = await this.userRepository.findOne({
                where: { uuid: stored.userUuid },
            });
            if (user === null) return { status: 'denied' };

            const tokens = this.authService.login(user);
            return {
                status: 'approved',
                authToken: tokens[CookieNames.AUTH_TOKEN],
                refreshToken: tokens[CookieNames.REFRESH_TOKEN],
            };
        }

        const now = Date.now();
        const tooEarly =
            stored.lastPolledAt !== undefined &&
            now - Date.parse(stored.lastPolledAt) <
                (DEVICE_POLL_INTERVAL_SECONDS - 1) * 1000;
        stored.lastPolledAt = new Date(now).toISOString();
        await this.redis.set(key, JSON.stringify(stored), 'KEEPTTL');

        return { status: tooEarly ? 'slow_down' : 'pending' };
    }

    private async decide(
        userCode: string,
        status: 'approved' | 'denied',
        userUuid?: string,
    ): Promise<DeviceAuthorizationInfoDto> {
        const { stored, deviceCodeHash } = await this.findByUserCode(userCode);
        if (stored.status !== 'pending') {
            throw new BadRequestException(
                `This login was already ${stored.status}.`,
            );
        }

        stored.status = status;
        stored.userUuid = userUuid;
        await this.redis.set(
            deviceKey(deviceCodeHash),
            JSON.stringify(stored),
            'KEEPTTL',
        );
        return this.info(stored.userCode);
    }

    private async findByUserCode(userCode: string): Promise<{
        stored: StoredDeviceAuthorization;
        deviceCodeHash: string;
    }> {
        const normalized = normalizeUserCode(userCode);
        const deviceCodeHash = await this.redis.get(userCodeKey(normalized));
        if (deviceCodeHash === null) throw this.notFound();

        const raw = await this.redis.get(deviceKey(deviceCodeHash));
        if (raw === null) throw this.notFound();

        return {
            stored: JSON.parse(raw) as StoredDeviceAuthorization,
            deviceCodeHash,
        };
    }

    private async remove(
        deviceCodeHash: string,
        userCode: string,
    ): Promise<void> {
        await this.redis.del(deviceKey(deviceCodeHash), userCodeKey(userCode));
    }

    private notFound(): NotFoundException {
        return new NotFoundException(
            'This code is unknown or has expired. Run `klein login` again to get a new one.',
        );
    }
}
