import environment from '@backend-common/environment';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';

/** Interval of the background probe that keeps {@link LokiHealthService.isReady} current. */
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
 * while Loki is down produces a run whose logs are lost.
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
     * Loki's state as of the last probe.
     *
     * Cheap but up to {@link PROBE_INTERVAL_MS} stale, so this answers
     * "how is Loki doing?" (dashboards, health endpoints) rather than
     * "may I dispatch right now?". For the latter use {@link waitUntilReady}.
     */
    isReady(): boolean {
        return this.enabled ? this.ready : true;
    }

    /**
     * Probes Loki now, retrying with back-off before giving up.
     *
     * Deliberately never answers from the cached flag: a success cached
     * moments ago would let an action through after Loki has gone down, and
     * that action would run with no retrievable logs. Concurrent callers
     * share a single probe, and the total wait is bounded by
     * {@link RETRY_DELAYS_MS} so a request never hangs on a dead Loki.
     */
    async waitUntilReady(): Promise<boolean> {
        if (await this.probe()) return true;

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

        if (this.ready && !wasReady) {
            this.logger.log(`Loki at ${environment.LOKI_URL} is ready`);
        }

        return this.ready;
    }
}
