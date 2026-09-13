import { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Button, Input, cx } from '../ui';

/** "Use other prayers": choose any template for this day, or let LiturgyGen choose. */
export default function PrayerPicker({ templates, templateId, onChoose, onBack }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? templates.filter((t) => t.title.toLowerCase().includes(needle) || t.season.toLowerCase().includes(needle)) : templates;
  }, [templates, search]);

  const row = (selected) =>
    cx(
      'w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors',
      selected ? 'bg-navy text-page' : 'hover:bg-tile',
    );

  return (
    <div className="flex h-full flex-col">
      <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} className="-ml-3 self-start">
        Back to the day
      </Button>
      <h2 className="mt-2 font-serif text-2xl font-bold">Use other prayers</h2>
      <div className="relative mt-4">
        <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or season" className="pl-9" aria-label="Search prayers" />
      </div>
      <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto scroll-slim">
        <li>
          <button type="button" onClick={() => onChoose('')} className={row(!templateId)}>
            <span className="block font-semibold">Choose for me</span>
            <span className={cx('block text-sm', !templateId ? 'text-page/80' : 'text-muted')}>The occasion book first, then the Ordinary Time book</span>
          </button>
        </li>
        {filtered.map((template) => {
          const selected = String(template.id) === String(templateId);
          return (
            <li key={template.id}>
              <button type="button" onClick={() => onChoose(String(template.id))} className={row(selected)}>
                <span className="block font-medium">
                  {template.title}
                  {template.isPlaceholder && <span className={cx('ml-2 text-sm', selected ? 'text-gold' : 'text-muted')}>(placeholder)</span>}
                </span>
                <span className={cx('block text-sm', selected ? 'text-page/80' : 'text-muted')}>
                  {[template.season, template.week && `week ${template.week}`, template.dayOfWeek].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
