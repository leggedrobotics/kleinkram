import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { appVersion } from '../../app-version';
import logger from '../../logger';

/**
 *
 * A nest middleware that resolves the user from the API key in the request.
 *
 */
@Injectable()
export class VersionCheckerMiddlewareService implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void {
        let clientVersion = request.headers['kleinkram-client-version'] as
            | string
            | undefined;

        const requestPath = request.originalUrl;

        // ignore auth endpoints
        if (requestPath.startsWith('/auth/')) {
            next();
            return;
        }

        // strip away everything after .dev
        if (clientVersion !== undefined) {
            clientVersion = clientVersion.split('.dev')[0];
        }

        // verify if version is of semver format
        const validVersion = /^\d+\.\d+\.\d+$/;
        if (clientVersion !== undefined && !validVersion.test(clientVersion)) {
            this.rejectRequest(response, clientVersion);
            return;
        }

        logger.debug(
            `Check Client Version for call to endpoint: ${requestPath} is: ${clientVersion}`,
        );

        if (clientVersion === undefined) {
            this.rejectRequest(response, 'undefined');
            return;
        }

        // forbidden client versions: allows for the following notations
        const forbiddenClientVersions = ['<0.43.4'];

        if (this.isVersionForbidden(clientVersion, forbiddenClientVersions)) {
            this.rejectRequest(response, clientVersion);
            return;
        }

        next();
    }

    private rejectRequest(response: Response, clientVersion: string): void {
        // we need to manually set the version header here
        response.header('kleinkram-version', appVersion);

        // reject request with 426
        response.status(426).json({
            statusCode: 426,
            message: `Client version ${clientVersion} is not a valid version.`,
        });

        response.send();
    }

    private isVersionForbidden(
        clientVersion: string,
        forbiddenVersions: string[],
    ): boolean {
        for (const forbiddenVersion of forbiddenVersions) {
            if (forbiddenVersion.startsWith('<')) {
                const versionToCompare = forbiddenVersion.slice(1);
                if (this.isLessThan(clientVersion, versionToCompare)) {
                    return true;
                }
            } else if (forbiddenVersion.endsWith('.x')) {
                const baseVersion = forbiddenVersion.slice(
                    0,
                    Math.max(0, forbiddenVersion.length - 2),
                );
                if (clientVersion.startsWith(baseVersion)) {
                    return true;
                }
            } else if (clientVersion === forbiddenVersion) {
                return true;
            }
        }
        return false;
    }

    private isLessThan(version1: string, version2: string): boolean {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);

        const maxLength = Math.max(v1Parts.length, v2Parts.length);

        for (let index = 0; index < maxLength; index++) {
            const part1 = v1Parts[index] || 0;
            const part2 = v2Parts[index] || 0;

            if (part1 < part2) {
                return true;
            } else if (part1 > part2) {
                return false;
            }
        }

        return false;
    }
}
