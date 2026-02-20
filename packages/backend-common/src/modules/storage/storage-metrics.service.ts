import environment from '@backend-common/environment';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import jwt from 'jsonwebtoken';

// 1. Define interfaces to describe the shape of the data
interface MetricPoint {
    labels: Record<string, string>;
    value: number;
}

type PrometheusMetrics = Record<string, MetricPoint[]>;

@Injectable()
export class StorageMetricsService {
    private readonly METRICS_ENDPOINT =
        'http://seaweedfs:9000/minio/metrics/v3/system/drive';

    private readonly EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

    async getSystemMetrics(): Promise<PrometheusMetrics> {
        const token = this.generateMetricToken();

        try {
            const response = await axios.get(this.METRICS_ENDPOINT, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return this.parsePrometheusMetrics(response.data);
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to fetch storage metrics',
                { cause: error as Error },
            );
        }
    }

    private generateMetricToken(): string {
        const payload = {
            exp: Math.floor(Date.now() / 1000) + this.EXPIRATION_SECONDS,
            sub: environment.S3_ACCESS_KEY,
            iss: 'prometheus',
        };
        return jwt.sign(payload, environment.S3_SECRET_KEY, {
            algorithm: 'HS512',
        });
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
