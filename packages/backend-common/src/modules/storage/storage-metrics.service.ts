import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

// 1. Define interfaces to describe the shape of the data
export interface MetricPoint {
    labels: Record<string, string>;
    value: number;
}

export type PrometheusMetrics = Record<string, MetricPoint[]>;

@Injectable()
export class StorageMetricsService {
    private readonly METRICS_ENDPOINT = 'http://seaweedfs:9324/metrics';

    async getSystemMetrics(): Promise<PrometheusMetrics> {
        try {
            const response = await axios.get(this.METRICS_ENDPOINT);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return this.parsePrometheusMetrics(response.data);
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to fetch storage metrics',
                { cause: error as Error },
            );
        }
    }

    private parsePrometheusMetrics(metricsText: string): PrometheusMetrics {
        const lines = metricsText
            .split('\n')
            .filter((line) => line.trim() !== '');

        const result: PrometheusMetrics = {};

        for (const line of lines) {
            if (line.startsWith('#')) {
                continue;
            }

            const match = /^(\w+)\{(.+)}\s+(.+)$/.exec(line);

            if (match) {
                const metricName = match[1];
                const labelsText = match[2];
                const valueString = match[3];

                if (!metricName || !labelsText || !valueString) {
                    continue;
                }

                const labels: Record<string, string> = {};

                for (const labelPair of labelsText.split(',')) {
                    const parts = labelPair.split('=');
                    if (parts.length === 2) {
                        const [key, rawValue] = parts;
                        if (key) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                            labels[key] = rawValue?.replaceAll('"', '') ?? '';
                        }
                    }
                }

                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!result[metricName]) {
                    result[metricName] = [];
                }

                result[metricName].push({
                    labels,
                    value: Number.parseFloat(valueString),
                });
            }
        }

        return result;
    }
}
