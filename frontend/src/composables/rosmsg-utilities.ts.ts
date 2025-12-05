// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatPayload(data: any): string {
    if (data === null || data === undefined) return '[Empty]';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isBinary = data instanceof Uint8Array || data?.type === 'Buffer';
    if (isBinary) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const array = data.data
            ? // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              new Uint8Array(data.data)
            : new Uint8Array(data);
        const max = 12;
        const hex = [...array.subarray(0, max)]
            .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        return `[Binary ${array.byteLength} bytes] <${hex}${array.byteLength > max ? '...' : ''}>`;
    }

    if (typeof data === 'object') {
        try {
            // Use 2 spaces for indentation
            const jsonString = JSON.stringify(
                data,
                (_, v) => {
                    // Collapse large arrays to avoid vertical spam
                    if (Array.isArray(v) && v.length > 20)
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        return `[Array(${v.length})]`;
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return v;
                },
                2,
            );

            const maxLength = 500;
            if (jsonString.length > maxLength) {
                return `${jsonString.slice(0, maxLength)}\n... (truncated)`;
            }
            return jsonString;
        } catch {
            return String(data); // Fallback for circular references etc.
        }
    }

    // 3. Primitive formatting
    return String(data);
}
