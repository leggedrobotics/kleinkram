import type { Request, Response } from 'express';
import {
    NO_COMPRESSION_HEADER,
    shouldCompress,
} from '../../src/routing/middlewares/response-compression';

function fakeRequest(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
}

function fakeResponse(contentType: string): Response {
    return {
        getHeader: (name: string) =>
            name.toLowerCase() === 'content-type' ? contentType : undefined,
    } as unknown as Response;
}

describe('Response compression filter', () => {
    test('should compress JSON responses', () => {
        expect(
            shouldCompress(
                fakeRequest(),
                fakeResponse('application/json; charset=utf-8'),
            ),
        ).toBe(true);
    });

    test('should not compress server-sent events', () => {
        expect(
            shouldCompress(
                fakeRequest(),
                fakeResponse('text/event-stream; charset=utf-8'),
            ),
        ).toBe(false);
    });

    test('should not compress already compressed content types', () => {
        expect(
            shouldCompress(fakeRequest(), fakeResponse('application/zip')),
        ).toBe(false);
    });

    test('should not compress if the client sends x-no-compression', () => {
        expect(
            shouldCompress(
                fakeRequest({ [NO_COMPRESSION_HEADER]: '1' }),
                fakeResponse('application/json'),
            ),
        ).toBe(false);
    });
});
