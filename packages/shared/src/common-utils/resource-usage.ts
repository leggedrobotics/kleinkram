export interface ResourceSample {
    t: number; // Seconds from start
    c: number; // CPU %
    m: number; // Memory Bytes
}

export interface ResourceUsage {
    maxMemoryBytes: number;
    maxCpuPercent: number;
    avgCpuPercent: number;
    efficiencyScore?: number;
    samples: ResourceSample[];
}
