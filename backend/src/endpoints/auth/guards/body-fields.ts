import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Reads a list of uuids from a request body inside a guard.
 *
 * Guards run before the ValidationPipe, so the body's DTO hasn't been checked
 * yet. A guard that iterates over a field the client sent as a string or a
 * number would otherwise crash with a TypeError (500). A field that is present
 * but malformed is answered with 400, the same status the DTO would give.
 *
 * @returns the uuids, or `undefined` if the body or the field is missing
 */
export const readUuidArray = (
    body: unknown,
    key: string,
): string[] | undefined => {
    if (body === null || typeof body !== 'object') return undefined;

    const value = (body as Record<string, unknown>)[key];
    if (value === undefined) return undefined;

    if (
        !Array.isArray(value) ||
        !value.every((entry) => typeof entry === 'string' && isUUID(entry))
    ) {
        throw new BadRequestException(`${key} must be an array of UUIDs`);
    }
    return value as string[];
};
