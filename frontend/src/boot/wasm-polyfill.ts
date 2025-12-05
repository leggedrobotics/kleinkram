// src/boot/wasm-polyfill.ts
import { boot } from 'quasar/wrappers';

export default boot(() => {
    // Hack: The Foxglove libraries use a pattern where they try to `require` the .wasm file.
    // vite-plugin-wasm transforms imports, but if any 'require' remains in the excluded code, this catches it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-condition
    if (globalThis.window !== undefined && !(globalThis as any).require) {
        // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (globalThis as any).require = (module_: string) => {
            console.warn(`Blocked require call for: ${module_}`);
            // Return a dummy object or throw depending on what the lib expects.
            // Usually for WASM libs, the vite plugin intercepts the actual file load,
            // so this might just catch side-effect requires.
            return {};
        };
    }
});
