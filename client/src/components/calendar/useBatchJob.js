import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api';

/** Start a batch, follow its server-sent progress, cancel it, download results. */
export default function useBatchJob() {
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const source = useRef(null);

  const closeStream = useCallback(() => {
    if (source.current) {
      source.current.close();
      source.current = null;
    }
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const start = useCallback(
    async ({ dates, extraIntentions }) => {
      if (!dates.length) return;
      setStarting(true);
      setError(null);
      closeStream();
      try {
        const started = await api.startBatch({ dates, extraIntentions });
        setJob(started);
        // Server-Sent Events give the "Making day 4 of 22" counter without polling.
        const stream = new EventSource(`/api/batch/${started.id}/events`);
        source.current = stream;
        stream.onmessage = (event) => {
          const payload = JSON.parse(event.data);
          setJob(payload);
          if (['done', 'failed', 'cancelled'].includes(payload.status)) closeStream();
        };
        stream.onerror = () => {
          // The stream ends when the job finishes; fall back to one poll.
          closeStream();
          api.batch(started.id).then(setJob).catch(() => {});
        };
      } catch (err) {
        setError(err.message);
      } finally {
        setStarting(false);
      }
    },
    [closeStream],
  );

  const cancel = useCallback(async () => {
    if (job) await api.cancelBatch(job.id).catch(() => {});
  }, [job]);

  const reset = useCallback(() => {
    closeStream();
    setJob(null);
    setError(null);
  }, [closeStream]);

  const running = Boolean(job && job.status === 'running');
  const finished = Boolean(job && ['done', 'failed', 'cancelled'].includes(job.status));
  const percent = job && job.total ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0;

  return {
    job,
    starting,
    error,
    running,
    finished,
    percent,
    start,
    cancel,
    reset,
    downloadZip: () => api.downloadZip(job.id),
    downloadCombined: () => api.downloadCombined(job.id),
  };
}
