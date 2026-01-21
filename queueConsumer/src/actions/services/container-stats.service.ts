import { ResourceSample, ResourceUsage } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import type Dockerode from 'dockerode';
import logger from '../../logger';

/* eslint-disable @typescript-eslint/naming-convention */
interface DockerStats {
    read: string;
    memory_stats: {
        usage: number;
        stats?: {
            cache?: number;
        };
    };
    cpu_stats: {
        cpu_usage: {
            total_usage: number;
        };
        system_cpu_usage: number;
        online_cpus?: number;
    };
}
/* eslint-enable @typescript-eslint/naming-convention */

@Injectable()
export class ContainerStatsService {
    async collectStats(container: Dockerode.Container): Promise<ResourceUsage> {
        let maxMemory = 0;
        let maxCpu = 0;
        let totalCpu = 0;
        let cpuSamples = 0;
        const samples: ResourceSample[] = [];
        const startTime = Date.now();

        // Get the stream
        return new Promise<ResourceUsage>((resolve) => {
            logger.debug(
                `Starting stats polling for container ${container.id}`,
            );
            const pollInterval = 1000;
            let previousCpu = 0;
            let previousSystem = 0;
            let skippedSamples = 0;

            const collectionLoop = async () => {
                while (Boolean(container.id)) {
                    try {
                        // Just try to get stats - if container is gone, we'll get an error
                        const stats = (await container.stats({
                            stream: false,
                        })) as DockerStats;

                        if (!this.isValidStats(stats)) {
                            skippedSamples++;
                            await new Promise((r) =>
                                setTimeout(r, pollInterval),
                            );
                            continue;
                        }

                        const {
                            usedMemory,
                            cpuPercent,
                            currentCpu,
                            currentSystem,
                        } = this.calculateMetrics(
                            stats,
                            previousCpu,
                            previousSystem,
                        );

                        if (usedMemory > maxMemory) maxMemory = usedMemory;
                        if (cpuPercent > maxCpu) maxCpu = cpuPercent;

                        if (cpuPercent > 0) {
                            totalCpu += cpuPercent;
                            cpuSamples++;
                        }

                        // Docker stats snapshot handles deltas internally or gives cumulative?
                        // stats({stream:false}) returns specific structure.
                        // Usually it returns the *current* state.
                        // However, calculating CPU % requires previous usage.
                        // If we poll, we get cumulative usage. We can compare with previous sample.
                        // BUT, if we poll every 1s, we might miss spikes?
                        // It's acceptable for this usecase.

                        previousCpu = currentCpu;
                        previousSystem = currentSystem;

                        // 3. Add Sample
                        const elapsedTime = Math.floor(
                            (Date.now() - startTime) / 1000,
                        );

                        // Avoid duplicate timestamps
                        if (
                            samples.length === 0 ||
                            (samples.at(-1)?.t ?? -1) < elapsedTime
                        ) {
                            samples.push({
                                t: elapsedTime,
                                c: Number.parseFloat(cpuPercent.toFixed(2)),
                                m: usedMemory,
                            });
                        }

                        await new Promise((r) => setTimeout(r, pollInterval));
                    } catch (error: unknown) {
                        // If container is gone (404) or other error, stop
                        const errorMessage = String(error);
                        if (errorMessage.includes('404')) {
                            break;
                        }
                        logger.warn(
                            `Stats polling error for ${container.id}: ${errorMessage}`,
                        );
                        // Backoff slightly on error
                        await new Promise((r) => setTimeout(r, pollInterval));
                    }
                }

                const count = samples.length;
                logger.debug(
                    `Stats polling finished for container ${
                        container.id
                    }. Collected ${String(count)} valid samples (skipped ${String(
                        skippedSamples,
                    )} invalid).`,
                );

                const downsampled = this.downsample(samples, 100);

                resolve({
                    maxMemoryBytes: maxMemory,
                    maxCpuPercent: Number.parseFloat(maxCpu.toFixed(2)),
                    avgCpuPercent:
                        cpuSamples > 0
                            ? Number.parseFloat(
                                  (totalCpu / cpuSamples).toFixed(2),
                              )
                            : 0,
                    samples: downsampled,
                });
            };

            // Start the loop (fire and forget inside the promise wrapper)
            void collectionLoop();
        });
    }

    private downsample(
        samples: ResourceSample[],
        limit: number,
    ): ResourceSample[] {
        if (samples.length <= limit) return samples;

        const result: ResourceSample[] = [];
        const step = samples.length / limit;

        for (let index = 0; index < limit; index++) {
            const sampleIndex = Math.floor(index * step);
            const sample = samples.at(sampleIndex);
            if (sample) result.push(sample);
        }

        // Ensure the last sample is included
        const last = samples.at(-1);
        if (last && result.at(-1)?.t !== last.t) {
            result[result.length - 1] = last;
        }

        return result;
    }

    private isValidStats(stats: DockerStats): boolean {
        return !stats.read.startsWith('0001-01-01');
    }

    private calculateMetrics(
        stats: DockerStats,
        previousCpu: number,
        previousSystem: number,
    ): {
        usedMemory: number;
        cpuPercent: number;
        currentCpu: number;
        currentSystem: number;
    } {
        const usedMemory =
            stats.memory_stats.usage - (stats.memory_stats.stats?.cache ?? 0);
        const currentCpu = stats.cpu_stats.cpu_usage.total_usage;
        const currentSystem = stats.cpu_stats.system_cpu_usage;

        const cpuDelta = currentCpu - previousCpu;
        const systemDelta = currentSystem - previousSystem;
        const numberCpus = stats.cpu_stats.online_cpus ?? 1;

        let cpuPercent = 0;
        if (systemDelta > 0 && cpuDelta > 0 && previousSystem > 0) {
            cpuPercent = (cpuDelta / systemDelta) * numberCpus * 100;
        }

        return { usedMemory, cpuPercent, currentCpu, currentSystem };
    }
}
