import { LokiHealthService } from '@kleinkram/backend-common/modules/loki-health/loki-health.service';

jest.mock('axios', () => ({ get: jest.fn() }));

const { get: mockedGet } = jest.requireMock<{ get: jest.Mock }>('axios');

describe('LokiHealthService Unit Tests', () => {
    let service: LokiHealthService;
    let previousNodeEnvironment: string | undefined;

    beforeEach(() => {
        previousNodeEnvironment = process.env.NODE_ENV;

        // The service treats Loki as ready under NODE_ENV=test so the rest of
        // the suite does not need a live Loki. Exercise the real path here.
        process.env.NODE_ENV = 'development';

        mockedGet.mockReset();
        service = new LokiHealthService();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
        process.env.NODE_ENV = previousNodeEnvironment;
    });

    test('probes Loki once and serves later calls from the cache', async () => {
        mockedGet.mockResolvedValue({ status: 200 });

        await expect(service.isReady()).resolves.toBe(true);
        await expect(service.isReady()).resolves.toBe(true);

        expect(mockedGet).toHaveBeenCalledTimes(1);
        expect(mockedGet).toHaveBeenCalledWith(
            expect.stringMatching(/\/ready$/),
            expect.anything(),
        );
    });

    test('re-probes once the cached result is stale', async () => {
        mockedGet.mockResolvedValue({ status: 200 });

        await expect(service.isReady()).resolves.toBe(true);
        jest.advanceTimersByTime(10_000);
        await expect(service.isReady()).resolves.toBe(true);

        expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    test('waitUntilReady rides out a Loki that is still starting up', async () => {
        mockedGet
            .mockRejectedValueOnce(new Error('503 not ready'))
            .mockResolvedValue({ status: 200 });

        const readyPromise = service.waitUntilReady();
        await jest.advanceTimersByTimeAsync(500);

        await expect(readyPromise).resolves.toBe(true);
        expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    test('waitUntilReady gives up after a bounded number of retries', async () => {
        mockedGet.mockRejectedValue(new Error('connection refused'));

        const readyPromise = service.waitUntilReady();
        await jest.advanceTimersByTimeAsync(3500);

        await expect(readyPromise).resolves.toBe(false);
        expect(mockedGet).toHaveBeenCalledTimes(4);
    });

    test('collapses concurrent probes into a single request', async () => {
        mockedGet.mockResolvedValue({ status: 200 });

        const results = await Promise.all([
            service.isReady(),
            service.isReady(),
            service.isReady(),
        ]);

        expect(results).toEqual([true, true, true]);
        expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    test('is a no-op under NODE_ENV=test', async () => {
        process.env.NODE_ENV = 'test';
        const disabledService = new LokiHealthService();

        await expect(disabledService.isReady()).resolves.toBe(true);
        await expect(disabledService.waitUntilReady()).resolves.toBe(true);
        expect(mockedGet).not.toHaveBeenCalled();
    });
});
