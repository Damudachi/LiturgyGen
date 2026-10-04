import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api';

/** Start a batch, follow its server-sent progress, cancel it, download results. */
export default function useBatchJob() {
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  // Holds the stream's stop function, not a stream object.
  const source = useRef(null);

  const closeStream = useCallback(() => {
    if (source.current) {
      source.current();
      source.current = null;
    }
  }, []);

  useEffect(() => closeStream, [closeStream]);

  const start = useCallback(
    async ({ dates, extraIntentions, checkOnly = false }) => {
      if (!dates.length) return;
      setStarting(true);
      setError(null);
      closeStream();
      try {
        const started = await api.startBatch({ dates, extraIntentions, checkOnly });
        setJob(started);
        // Server-sent progress gives the "Making day 4 of 22" counter without
        // polling. api.streamBatch is a fetch rather than an EventSource, so it
        // can carry the access token - see httpApi.js for what that cost.
        source.current = api.streamBatch(started.id, {
          onUpdate: (payload) => {
            setJob(payload);
            if (['done', 'failed', 'cancelled'].includes(payload.status)) closeStream();
          },
          onError: () => {
            // The stream also ends when the job does; one poll settles which.
            closeStream();
            api.batch(started.id).then(setJob).catch(() => {});
          },
        });
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
