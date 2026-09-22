import environment from '@backend-common/environment';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';

/**
 * How long a probe result stays valid before we consider it stale.
 *
 * Also the interval of the background probe, so in steady state the cached
 * value is refreshed before it ever expires and no request path ever waits
 * for an HTTP round-trip to Loki.
 */
const PROBE_INTERVAL_MS = 10_000;

/** Timeout of a single `GET /ready` call. */
const PROBE_TIMEOUT_MS = 2000;

/**
 * Back-off between the on-demand retries performed by {@link
 * LokiHealthService.waitUntilReady}.
 *
 * Loki reports `/ready` as 503 for a while after startup (ring join, WAL
 * replay, `min_ready_duration`), so a single failed probe is not a good
 * reason to reject a request that is otherwise fine.
 */
const RETRY_DELAYS_MS = [500, 1000, 2000];

/**
 * Number of seconds a client should wait before retrying a request that was
 * rejected because Loki is not ready. Loki's default `min_ready_duration` is
 * 15s, which dominates the startup window.
 */
export const LOKI_RETRY_AFTER_SECONDS = 15;

const sleep = async (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tracks whether Loki is able to accept and serve logs.
 *
 * Action logs are only retrievable through Loki, so dispatching an action
 * while Loki is down produces a run whose logs are lost. Rather than probing
 * Loki inline on every dispatch, this service keeps a cached readiness flag
 * that is refreshed in the background.
 */
@Injectable()
export class LokiHealthService implements OnModuleInit {
    private readonly logger = new Logger(LokiHealthService.name);

    /**
     * Tests run without the observability stack; treat Loki as ready there
     * instead of making every test depend on a live Loki.
     */
    private readonly enabled = process.env.NODE_ENV !== 'test';

    private ready = false;
    private lastProbedAt = 0;

    /**
     * Deduplicates concurrent probes: when Loki is down, every in-flight
     * dispatch would otherwise hammer it with its own `/ready` calls.
     */
    private inFlightProbe: Promise<boolean> | undefined;

    async onModuleInit(): Promise<void> {
        await this.probe();
    }

    @Interval(PROBE_INTERVAL_MS)
    async refresh(): Promise<void> {
        await this.probe();
    }

    /**
     * Readiness as of the last probe, re-probing only if that result is stale.
     */
    async isReady(): Promise<boolean> {
        if (!this.enabled) return true;
        if (Date.now() - this.lastProbedAt < PROBE_INTERVAL_MS) {
            return this.ready;
        }
        return this.probe();
    }

    /**
     * Readiness, retrying with back-off before giving up.
     *
     * Use this on request paths that must reject when Loki is unavailable: it
     * rides out a short blip (a restart, a slow ring join) instead of failing
     * a submission that would have worked a moment later. The total wait is
     * bounded by {@link RETRY_DELAYS_MS} so callers stay responsive.
     */
    async waitUntilReady(): Promise<boolean> {
        if (await this.isReady()) return true;

        for (const delay of RETRY_DELAYS_MS) {
            await sleep(delay);
            if (await this.probe()) return true;
        }

        return false;
    }

    private async probe(): Promise<boolean> {
        if (!this.enabled) return true;

        this.inFlightProbe ??= this.runProbe().finally(() => {
            this.inFlightProbe = undefined;
        });
        return this.inFlightProbe;
    }

    private async runProbe(): Promise<boolean> {
        const wasReady = this.ready;
        try {
            await axios.get(`${environment.LOKI_URL}/ready`, {
                timeout: PROBE_TIMEOUT_MS,
            });
            this.ready = true;
        } catch (error) {
            this.ready = false;
            if (wasReady) {
                this.logger.error(
                    `Loki at ${environment.LOKI_URL} became unreachable: ${String(error)}`,
                );
            }
        }

        this.lastProbedAt = Date.now();

        if (this.ready && !wasReady) {
            this.logger.log(`Loki at ${environment.LOKI_URL} is ready`);
        }

        return this.ready;
    }
}
