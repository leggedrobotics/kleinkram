export function parseMinioMetrics(metricsText) {
    const lines = metricsText.split('\n').filter((line) => line.trim() !== '');

    const result = {};

    for (const line of lines) {
        // Skip comments
        if (line.startsWith('#')) {
            continue;
        }

        // Match metric lines
        const match = line.match(/^(\w+)\{(.+)\}\s+(.+)$/);
        if (match) {
            const [, metricName, labelsText, value] = match;

            // Parse labels
            const labels = {};
            for (const labelPair of labelsText.split(',')) {
                const [key, value_] = labelPair.split('=');
                labels[key] = value_.replaceAll('"', ''); // Remove quotes
            }

            // Add to the result object
            if (!result[metricName]) {
                result[metricName] = [];
            }
            result[metricName].push({
                labels,
                value: Number.parseFloat(value),
            });
        }
    }

    return result;
}
