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
    async collectStats(
        container: Dockerode.Container,
        onStatsUpdate?: (stats: ResourceUsage) => void,
    ): Promise<ResourceUsage> {
        let maxMemory = 0;
        let maxCpu = 0;
        let totalCpu = 0;
        let cpuSamples = 0;
        const samples: ResourceSample[] = [];
        const startTime = Date.now();

        logger.debug(`Starting stats streaming for container ${container.id}`);

        return new Promise<ResourceUsage>((resolve) => {
            let previousCpu = 0;
            let previousSystem = 0;
            let buffer = '';

            const onFinished = () => {
                const count = samples.length;
                logger.debug(
                    `Stats streaming finished for container ${
                        container.id
                    }. Collected ${String(count)} valid samples.`,
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

            container
                .stats({ stream: true })
                .then((stream) => {
                    const dataStream = stream;

                    dataStream.on('data', (chunk: Buffer) => {
                        buffer += chunk.toString();

                        while (buffer.includes('\n')) {
                            const newlineIndex = buffer.indexOf('\n');
                            const line = buffer.slice(0, newlineIndex).trim();
                            buffer = buffer.slice(newlineIndex + 1);

                            if (!line) continue;

                            try {
                                const stats = JSON.parse(line) as DockerStats;

                                if (!this.isValidStats(stats)) {
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

                                if (usedMemory > maxMemory)
                                    maxMemory = usedMemory;
                                if (cpuPercent > maxCpu) maxCpu = cpuPercent;

                                if (cpuPercent > 0) {
                                    totalCpu += cpuPercent;
                                    cpuSamples++;
                                }

                                previousCpu = currentCpu;
                                previousSystem = currentSystem;

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
                                        c: Number.parseFloat(
                                            cpuPercent.toFixed(2),
                                        ),
                                        m: usedMemory,
                                    });

                                    if (onStatsUpdate) {
                                        onStatsUpdate({
                                            maxMemoryBytes: maxMemory,
                                            maxCpuPercent: Number.parseFloat(
                                                maxCpu.toFixed(2),
                                            ),
                                            avgCpuPercent:
                                                cpuSamples > 0
                                                    ? Number.parseFloat(
                                                          (
                                                              totalCpu /
                                                              cpuSamples
                                                          ).toFixed(2),
                                                      )
                                                    : 0,
                                            samples: this.downsample(
                                                samples,
                                                100,
                                            ),
                                        });
                                    }
                                }
                            } catch (error) {
                                logger.warn(
                                    `Error parsing stats JSON: ${String(
                                        error,
                                    )}`,
                                );
                            }
                        }
                    });

                    dataStream.on('end', () => {
                        onFinished();
                    });

                    dataStream.on('error', (error) => {
                        logger.warn(
                            `Stats stream error for ${container.id}: ${String(
                                error,
                            )}`,
                        );
                        onFinished();
                    });
                })
                .catch((error: unknown) => {
                    logger.warn(
                        `Failed to start stats stream for ${
                            container.id
                        }: ${String(error)}`,
                    );
                    onFinished();
                });
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
