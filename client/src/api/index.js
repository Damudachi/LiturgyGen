/**
 * The only API module the components import from.
 *
 * Swapping the simulated backend for the real one is a single environment
 * variable, set at BUILD time. Nothing in src/components changes.
 *
 *   VITE_USE_MOCK_API=false          -> the Express API at VITE_API_BASE_URL
 *   anything else, INCLUDING UNSET   -> the browser-only demo
 *
 * Note which way round that is. Demo mode is the DEFAULT, so the GitHub Pages
 * build works before the API is deployed anywhere. The alternative - defaulting
 * to the real API - means a forgotten variable produces a deployed site that
 * calls an empty URL and fails on every request with nothing on the page
 * explaining why. A visible demo notice is a far better failure than a silently
 * broken app.
 *
 * Both modules are imported statically and one is chosen at run time. The
 * tempting version uses `await import(...)` to load only what is needed, and it
 * does not build: top-level await is not in Vite's default browser target, so
 * `vite build` fails with "Top-level await is not available in the configured
 * target environment".
 *
 * The desktop build is always the real thing: it serves the client from its own
 * bundled Express process, and it is built with VITE_USE_MOCK_API unset on a
 * machine where `false` is what the packaging script sets.
 */

import mockApi from './mockApi.js';
import httpApi from './httpApi.js';

export const USING_MOCK_API = import.meta.env.VITE_USE_MOCK_API !== 'false';

export const api = USING_MOCK_API ? mockApi : httpApi;

export default api;
