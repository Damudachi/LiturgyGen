/**
 * The real client. Every function here talks to the Express API.
 *
 * `mockApi.js` beside this file answers the same calls from a seeded snapshot
 * so the GitHub Pages build works without a server; `index.js` chooses between
 * them. Whatever is added here has to be added there too, or demo mode breaks
 * on a screen that used to work.
 *
 * Every call returns parsed JSON or throws an Error carrying the server's own
 * message, which the UI shows verbatim.
 *
 * BASE is empty in the two cases where the client and the API share an origin:
 * the Vite dev server (which proxies /api) and the desktop build (where Express
 * serves the built client itself). It is set only for a client deployed apart
 * from its API, as on GitHub Pages.
 */

import { accessToken } from '../lib/supabase.js';

const BASE = import.meta.env.VITE_API_BASE_URL || '';

/**
 * The headers every call carries.
 *
 * The access token goes on as a Bearer header rather than relying on a cookie,
 * which is what lets the client live on a different origin from the API without
 * any CORS credential dance. It is fetched per request because supabase-js
 * refreshes it in the background - caching it here would mean sending an expired
 * one for the first call after every refresh.
 */
async function authHeaders(hasBody) {
  const headers = hasBody ? { 'Content-Type': 'application/json' } : {};
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    signal,
    headers: await authHeaders(Boolean(body)),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const error = new Error((payload && payload.error) || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = payload && payload.code;
    error.attempts = payload && payload.attempts;
    error.hint = payload && payload.hint;
    throw error;
  }

  return payload;
}

/** Download a binary response as a file, using the server's filename. */
async function download(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: await authHeaders(Boolean(body)),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Download failed (${response.status}).`;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || message;
      const error = new Error(message);
      error.hint = parsed.hint;
      throw error;
    } catch (error) {
      if (error instanceof Error && error.message !== message) throw error;
      throw new Error(message);
    }
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const fileName = match ? match[1] : 'download';

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously races the browser's own read of the blob, which
  // some browsers resolve by cancelling the download. Let it finish first.
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return fileName;
}

/**
 * Follow a batch's server-sent progress.
 *
 * This used to be `new EventSource('/api/batch/<id>/events')` and it stopped
 * working the day the API grew a gate. EventSource cannot send headers - there
 * is no options argument - so the stream went out with no `Authorization`,
 * `requireAuth` answered 401, `onerror` fired at once and the panel sat on
 * whatever the single fallback poll happened to catch. The bar never moved, and
 * nothing said why: a 401 on an EventSource is an error event with no status on
 * it. It also ignored BASE, so a client deployed apart from its API asked its
 * own origin for the stream.
 *
 * So it is a `fetch` instead, which carries the same Bearer header as every
 * other call. The body is read as it arrives and split on the blank line that
 * ends an SSE event; only `data:` lines are used, which is all the server
 * sends.
 *
 * Returns a function that stops reading.
 */
function streamBatch(id, { onUpdate, onError } = {}) {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${BASE}/api/batch/${id}/events`, {
        headers: await authHeaders(false),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`Progress stream failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // An SSE event ends at a blank line. Whatever follows the last one is a
        // partial event, and waits in the buffer until the rest arrives.
        let split = buffer.indexOf('\n\n');
        while (split !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const data = frame
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('');
          if (data) {
            try {
              onUpdate?.(JSON.parse(data));
            } catch {
              /* a half-written frame is not worth tearing the stream down for */
            }
          }
          split = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') onError?.(error);
    }
  })();

  return () => controller.abort();
}

/**
 * Send one prayer-book file up and get drafts back. Nothing is saved yet.
 *
 * The file goes as its own body with its own Content-Type rather than as
 * multipart, which is what the route expects - so this cannot use `request()`,
 * whose job is JSON. The Bearer header is the same one.
 */
async function importExtract(file) {
  const response = await fetch(`${BASE}/api/potf/import/extract`, {
    method: 'POST',
    headers: {
      ...(await authHeaders(false)),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text };
  }
  if (!response.ok) {
    const error = new Error((payload && payload.error) || `Upload failed (${response.status}).`);
    error.status = response.status;
    error.code = payload && payload.code;
    throw error;
  }
  return payload;
}

export const api = {
  health: () => request('/health'),

  // Calendar
  month: (year, month) => request(`/calendar/month/${year}/${month}`),
  day: (date) => request(`/calendar/day/${date}`),
  expand: (spec) => request('/calendar/expand', { method: 'POST', body: spec }),

  // Readings
  readings: (date, { force } = {}) => request(`/readings/${date}${force ? '?force=1' : ''}`),
  fullDay: (date, { force } = {}) => request(`/readings/${date}/full${force ? '?force=1' : ''}`),
  saveReadings: (date, patch) => request(`/readings/${date}`, { method: 'PUT', body: patch }),
  clearOverride: (date) => request(`/readings/${date}/override`, { method: 'DELETE' }),
  importReadings: (date, html) => request(`/readings/${date}/import`, { method: 'POST', body: { html } }),
  clearCache: (date) => request(`/readings/cache${date ? `?date=${date}` : ''}`, { method: 'DELETE' }),
  providers: () => request('/readings/providers'),
  checkDays: (dates) => request('/readings/check', { method: 'POST', body: { dates } }),

  // Generation
  preview: (payload) => request('/generate/preview', { method: 'POST', body: payload }),
  generate: (payload) => download('/generate', { method: 'POST', body: payload }),

  // Batch
  startBatch: (payload) => request('/batch', { method: 'POST', body: payload }),
  batch: (id) => request(`/batch/${id}`),
  cancelBatch: (id) => request(`/batch/${id}/cancel`, { method: 'POST' }),
  streamBatch,

  // Importing a prayer book
  importExtract,
  importCommit: (prayers) => request('/potf/import/commit', { method: 'POST', body: { prayers } }),
  downloadZip: (id) => download(`/batch/${id}/zip`),
  downloadCombined: (id) => download(`/batch/${id}/combined`),

  // Prayers of the Faithful
  potfMeta: () => request('/potf/meta'),
  potfList: (query = {}) => {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, value]) => value !== '' && value != null),
    ).toString();
    return request(`/potf${params ? `?${params}` : ''}`);
  },
  potfResolve: (date) => request(`/potf/resolve/${date}`),
  potfCreate: (body) => request('/potf', { method: 'POST', body }),
  potfUpdate: (id, body) => request(`/potf/${id}`, { method: 'PUT', body }),
  potfDuplicate: (id) => request(`/potf/${id}/duplicate`, { method: 'POST' }),
  potfDelete: (id) => request(`/potf/${id}`, { method: 'DELETE' }),
  potfParse: (text) => request('/potf/parse', { method: 'POST', body: { text } }),
  potfImport: (body) => request('/potf/import', { method: 'POST', body }),

  // Settings & schedule
  // Account and parish.
  account: () => request('/account'),
  createOrganisation: (name) => request('/account/organisation', { method: 'POST', body: { name } }),

  settings: () => request('/settings'),
  saveSettings: (body) => request('/settings', { method: 'PUT', body }),
  schedule: (range = {}) => {
    const params = new URLSearchParams(
      Object.entries(range).filter(([, value]) => value),
    ).toString();
    return request(`/settings/schedule${params ? `?${params}` : ''}`);
  },
  addSchedule: (body) => request('/settings/schedule', { method: 'POST', body }),
  removeSchedule: (date) => request(`/settings/schedule/${date}`, { method: 'DELETE' }),
};

export default api;
