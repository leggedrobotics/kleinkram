export interface GeoPoint {
    lat: number;
    lon: number;
}

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance between two points in metres (haversine formula). */
export const haversineDistance = (a: GeoPoint, b: GeoPoint): number => {
    const earthRadius = 6_371_000;
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.lat)) *
            Math.cos(toRadians(b.lat)) *
            Math.sin(dLon / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Length of a polyline of geographic points in metres. */
export const trackLengthMetres = (points: GeoPoint[]): number => {
    let total = 0;
    for (let index = 1; index < points.length; index++) {
        const a = points[index - 1];
        const b = points[index];
        if (a && b) total += haversineDistance(a, b);
    }
    return total;
};
