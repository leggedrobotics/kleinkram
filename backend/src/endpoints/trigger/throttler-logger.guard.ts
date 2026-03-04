import logger from '@/logger';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class ThrottlerLoggerGuard extends ThrottlerGuard {
    protected async throwThrottlingException(
        context: ExecutionContext,
        throttlerLimitDetail: ThrottlerLimitDetail,
    ): Promise<void> {
        const request = context.switchToHttp().getRequest<Request>();
        const ip = request.ip ?? request.socket.remoteAddress;

        logger.warn(
            `Throttling request from IP: ${String(ip)} Endpoint: ${request.method} ${request.originalUrl}. Limit exceeded: ${String(throttlerLimitDetail.limit)} requests within ${String(throttlerLimitDetail.ttl)}ms`,
        );

        await super.throwThrottlingException(context, throttlerLimitDetail);
    }
}
