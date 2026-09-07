/** Thin wrapper over the LiturgyGen API. Every call returns parsed JSON or throws
 *  an Error carrying the server's message, which the UI shows verbatim. */

async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

  // Generation
  preview: (payload) => request('/generate/preview', { method: 'POST', body: payload }),
  generate: (payload) => download('/generate', { method: 'POST', body: payload }),

  // Batch
  startBatch: (payload) => request('/batch', { method: 'POST', body: payload }),
  batch: (id) => request(`/batch/${id}`),
  cancelBatch: (id) => request(`/batch/${id}/cancel`, { method: 'POST' }),
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
