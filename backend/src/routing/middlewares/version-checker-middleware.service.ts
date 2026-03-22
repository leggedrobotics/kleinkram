import { appVersion } from '@/app-version';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { HttpException } from '@nestjs/common/exceptions/http.exception';
import { NextFunction, Request, Response } from 'express';
import logger from '../../logger';

/**
 * Configuration for forbidden version ranges.
 * Supported patterns:
 * - `<x.y.z`: Block all versions strictly less than x.y.z.
 * - `x.y.*`: Block all versions in the x.y family (wildcard *).
 * - `x.y.z`: Block an exact version match.
 *
 */
const FORBIDDEN_RANGES = ['<0.58.0'];

/**
 * Enforces client version compatibility by inspecting the request headers.
 *
 * This middleware extracts the `kleinkram-client-version`, sanitizes it,
 * and validates it against a defined blocklist (`FORBIDDEN_RANGES`).
 *
 * If the version is missing, invalid, or forbidden, the request is rejected
 * with a 426 (Upgrade Required) status.
 */
@Injectable()
export class VersionCheckerMiddlewareService implements NestMiddleware {
    use(request: Request, response: Response, next: NextFunction): void {
        let clientVersion = request.headers['kleinkram-client-version'] as
            | string
            | undefined;

        const requestPath = request.originalUrl;

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
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Check Client Version for call to endpoint: ${requestPath} is: ${clientVersion}`,
        );

        if (clientVersion === undefined) {
            this.rejectRequest(response, 'undefined');
            return;
        }

        if (this.isVersionForbidden(clientVersion, FORBIDDEN_RANGES)) {
            this.rejectRequest(response, clientVersion);
            return;
        }

        next();
    }

    /**
     * Terminates the request with a 426 Upgrade Required error.
     *
     * Side Effect:
     * - Sets the `kleinkram-version` header to the current `appVersion`
     * so the client knows which version the server is running.
     *
     * @throws HttpException (426)
     */
    private rejectRequest(response: Response, clientVersion: string): void {
        // Set the version header to inform the client about the required version
        response.header('kleinkram-version', appVersion);

        throw new HttpException(
            {
                statusCode: 426,
                message: `Client version ${clientVersion} is not supported. Please upgrade to at least version ${appVersion}.`,
                error: 'Upgrade Required',
            },
            426, // HTTP 426 Upgrade Required
        );
    }

    /**
     * Checks if a specific client version matches any rule in the forbidden list.
     *
     * @param clientVersion - The sanitized client version (e.g. "0.55.0")
     * @param forbiddenVersions - Array of rules (e.g. ["<0.55.1", "1.0.x"])
     */
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
            } else if (forbiddenVersion.endsWith('.*')) {
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

    /**
     * Custom semantic version comparison logic.
     * Compares two version strings part by part (Major -> Minor -> Patch).
     *
     * @returns true if version1 is strictly less than version2
     * @example
     * isLessThan('0.5.0', '0.6.0') // true
     * isLessThan('1.0.1', '1.0.0') // false
     */
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
