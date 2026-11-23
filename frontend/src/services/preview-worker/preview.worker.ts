/**
 * Entry of the preview worker. The global scope is typed as a window here
 * (the app is compiled against the DOM library), so it is narrowed to the
 * members the protocol needs.
 */
import { servePreview } from './host';
import type { Endpoint } from './protocol';

servePreview(globalThis as unknown as Endpoint);
