import {
    isImageInDockerNamespace,
    normalizeDockerNamespace,
} from '@kleinkram/validation';

describe('isImageInDockerNamespace', () => {
    it.each([
        [undefined, 'any.registry.io/x'],
        ['', 'any.registry.io/x'],
        ['rslethz', 'rslethz/x'],
        ['rslethz', 'rslethz/x:1.0'],
        ['rslethz/', 'rslethz/x'],
        [' rslethz ', 'rslethz/x'],
        ['my-org_1', 'my-org_1/x'],
    ])('allows namespace %p with image %p', (namespace, image) => {
        expect(isImageInDockerNamespace(image, namespace)).toBe(true);
    });

    it.each([
        ['rslethz', 'rslethzevil/x'],
        ['rslethz', 'rslethz.evil.io/x'],
        ['rslethz', 'rslethz'],
        ['rslethz', 'evil.io/rslethz/x'],
        ['evil.io/org', 'evil.io/org/x'],
        ['evil.io', 'evil.io/x'],
        ['host:5000', 'host:5000/x'],
        ['localhost', 'localhost/x'],
    ])('rejects namespace %p with image %p', (namespace, image) => {
        expect(isImageInDockerNamespace(image, namespace)).toBe(false);
    });
});

describe('normalizeDockerNamespace', () => {
    it.each([
        [undefined, ''],
        ['  ', ''],
        ['rslethz', 'rslethz'],
        ['rslethz//', 'rslethz'],
    ])('normalizes %p to %p', (namespace, expected) => {
        expect(normalizeDockerNamespace(namespace)).toBe(expected);
    });
});
