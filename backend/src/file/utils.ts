export function parseMinioMetrics(metricsText) {
    const lines = metricsText.split('\n').filter((line) => line.trim() !== '');

    const result = {};

    lines.forEach((line) => {
        // Skip comments
        if (line.startsWith('#')) {
            return;
        }

        // Match metric lines
        const match = line.match(/^(\w+)\{(.+)\}\s+(.+)$/);
        if (match) {
            const [, metricName, labelsText, value] = match;

            // Parse labels
            const labels = {};
            labelsText.split(',').forEach((labelPair) => {
                const [key, val] = labelPair.split('=');
                labels[key] = val.replace(/"/g, ''); // Remove quotes
            });

            // Add to the result object
            if (!result[metricName]) {
                result[metricName] = [];
            }
            result[metricName].push({
                labels,
                value: parseFloat(value),
            });
        }
    });

    return result;
}
