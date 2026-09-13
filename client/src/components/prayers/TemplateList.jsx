import { ClipboardPaste, Plus, Search } from 'lucide-react';
import { Button, Input, Select, cx } from '../ui';

/** The prayers, grouped by season, on stone. */
export default function TemplateList({ templates, total, seasons, search, onSearch, seasonFilter, onSeasonFilter, selectedId, onSelect, onNew, onTypeIn }) {
  const groups = seasons
    .map((season) => ({ season, items: templates.filter((template) => template.season === season) }))
    .filter((group) => group.items.length);

  return (
    <aside aria-label="Prayers" className="flex min-h-0 flex-col gap-3 rounded-md bg-page p-4 ring-1 ring-edge">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-serif text-[28px] font-bold">Prayers</h1>
        <span className="text-sm text-muted">{total} in all</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" icon={Plus} onClick={onNew}>
          New prayer
        </Button>
        <Button icon={ClipboardPaste} onClick={onTypeIn} className="bg-page-hi">
          Type in
        </Button>
      </div>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted" />
        <Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search titles and intentions" className="pl-9" aria-label="Search prayers" />
      </div>
      <Select value={seasonFilter} onChange={(event) => onSeasonFilter(event.target.value)} aria-label="Season">
        <option value="">All seasons</option>
        {seasons.map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </Select>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {groups.map((group) => (
          <section key={group.season} className="mb-3">
            <h2 className="sticky top-0 bg-page py-1 font-serif text-[15px] font-bold text-ink">{group.season}</h2>
            <ul className="space-y-0.5">
              {group.items.map((template) => {
                const selected = selectedId === template.id;
                return (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(template)}
                      className={cx('w-full cursor-pointer rounded-[4px] px-3 py-2 text-left transition-colors', selected ? 'bg-[#e8edf6] text-ink shadow-[inset_3px_0_0_var(--color-navy)]' : 'hover:bg-page-hi')}
                    >
                      <span className="block truncate font-medium">{template.title}</span>
                      <span className="block text-sm text-muted">
                        {[template.week && `week ${template.week}`, template.dayOfWeek, `${template.intentions.length} intentions`].filter(Boolean).join(', ')}
                        {template.isPlaceholder && <span className="ml-1.5 font-semibold text-rubric">placeholder</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Nothing matches that search.</p>}
      </div>
    </aside>
  );
}
