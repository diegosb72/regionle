import { BookOpen, Database, ExternalLink, Map as MapIcon, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { linksFor, type StudyLink } from '../lib/links';
import { cx } from '../lib/text';
import type { Item } from '../lib/types';

export const BASE = import.meta.env.BASE_URL;

export function Flag({ code, size = 'md', className }: { code?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  if (!code) return <span className={cx('flag flag-none', `flag-${size}`, className)} aria-hidden="true" />;
  return <img className={cx('flag', `flag-${size}`, className)} src={`${BASE}flags/${code}.svg`} alt="" loading="lazy" decoding="async" draggable={false} />;
}

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** Segmented control: one choice among a few. */
export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
  small,
}: {
  value: T;
  options: SegOption<T>[];
  onChange(v: T): void;
  label: string;
  small?: boolean;
}) {
  return (
    <div className={cx('seg', small && 'seg-sm')} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} title={o.title} className={cx('seg-btn', o.value === value && 'on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children, hint }: { checked: boolean; onChange(v: boolean): void; children: ReactNode; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      <span className="toggle-text">
        {children}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

const LINK_ICON = { wiki: BookOpen, map: MapIcon, video: Video, data: Database, list: ExternalLink } as const;

export function LinkPill({ link }: { link: StudyLink }) {
  const Icon = LINK_ICON[link.kind];
  return (
    <a className="pill-link" href={link.href} target="_blank" rel="noopener noreferrer" title={link.title}>
      <Icon size={14} aria-hidden="true" />
      {link.label}
    </a>
  );
}

/** Where to read more about an item. */
export function StudyLinks({ item, extra }: { item: Item; extra?: StudyLink[] }) {
  return (
    <div className="links" aria-label={`Aprende más sobre ${item.name}`}>
      {linksFor(item).map((l) => (
        <LinkPill key={l.kind} link={l} />
      ))}
      {extra?.map((l) => (
        <LinkPill key={l.href} link={l} />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" aria-hidden="true" />
      <span>{label ?? 'Cargando…'}</span>
    </div>
  );
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
