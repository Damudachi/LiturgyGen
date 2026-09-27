import { TriangleAlert } from 'lucide-react';
import { USING_MOCK_API } from '../api';

/**
 * Shown only while the simulated backend is switched on. It disappears by
 * itself the moment VITE_USE_MOCK_API is set to `false`, because it reads the
 * same variable the API layer does.
 *
 * Leave this in. A deployment that quietly pretends to have a server is the
 * difference between a deliberate staging site and a submission hoping nobody
 * checks.
 */
export default function DemoNotice() {
  if (!USING_MOCK_API) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-gold-edge/40 bg-note px-6 py-2.5 text-sm leading-normal text-note-ink"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0">
        <strong className="font-semibold">Demo mode.</strong> This deployment shows the interface only. It runs on a{' '}
        <strong className="font-semibold">simulated backend</strong> inside your browser: the calendar is a snapshot of
        September and October 2026, the readings are citations without their text, and the prayers are placeholders
        written for this tool. Nothing here reaches a server, and anything you type stays on this device. Making Word
        files needs the real API. See the{' '}
        <a
          href="https://github.com/Damudachi/LiturgyGen#readme"
          className="underline underline-offset-2 hover:no-underline"
        >
          README
        </a>
        .
      </p>
    </div>
  );
}
