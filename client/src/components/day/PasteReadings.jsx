import { useState } from 'react';
import { ArrowLeft, ClipboardPaste } from 'lucide-react';
import { Button, Textarea } from '../ui';

const usccbUrl = (iso) => `https://bible.usccb.org/bible/readings/${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(2, 4)}.cfm`;

/** For when the readings website blocks LiturgyGen: paste the page source by hand. */
export default function PasteReadings({ iso, busy, onImport, onBack }) {
  const [html, setHtml] = useState('');
  return (
    <div>
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-3">
        Back to the day
      </Button>
      <h2 className="mt-2 font-serif text-[26px] font-bold">Paste from USCCB</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-base">
        <li>
          Open{' '}
          <a className="font-medium text-navy underline underline-offset-3" target="_blank" rel="noreferrer" href={usccbUrl(iso)}>
            the USCCB readings for this day
          </a>
          .
        </li>
        <li>Right-click the page and choose View page source.</li>
        <li>Select all of it, copy, and paste it below.</li>
      </ol>
      <Textarea
        rows={10}
        value={html}
        onChange={(event) => setHtml(event.target.value)}
        placeholder="<!doctype html> …"
        className="mt-4 font-mono text-sm"
        aria-label="USCCB page source"
      />
      <Button className="mt-3" variant="primary" icon={ClipboardPaste} onClick={() => onImport(html)} loading={busy === 'import'} disabled={html.trim().length < 200}>
        Use these readings
      </Button>
    </div>
  );
}
