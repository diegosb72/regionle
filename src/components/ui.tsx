import { BookOpen, Database, ExternalLink, Map as MapIcon, MessageSquareWarning, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { L } from '../lib/i18n';
import { linksFor, type StudyLink } from '../lib/links';
import { reportUrl, type ReportAbout } from '../lib/report';
import { useStore } from '../lib/store';
import { cx } from '../lib/text';
import type { Item } from '../lib/types';
import { VERSION } from '../lib/version';

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

const LINK_ICON = { wiki: BookOpen, map: MapIcon, video: Video, data: Database, list: ExternalLink, report: MessageSquareWarning } as const;

export function LinkPill({ link }: { link: StudyLink }) {
  const Icon = LINK_ICON[link.kind];
  return (
    <a className={link.kind === 'report' ? 'pill-link pill-report' : 'pill-link'} href={link.href} target="_blank" rel="noopener noreferrer" title={link.title}>
      <Icon size={14} aria-hidden="true" />
      {link.label}
    </a>
  );
}

/** The link that tells of a mistake in what the game says about an item, in the game that is being played. */
export function reportLink(item: Item, game: ReportAbout['game']): StudyLink {
  return {
    kind: 'report',
    label: L('Avisar de un error', 'Report a mistake'),
    title: L(`¿Algo de ${item.name} está mal? Dilo en GitHub: el aviso se abre ya rellenado.`, `Is something about ${item.name} wrong? Say so on GitHub: the report opens already filled in.`),
    href: reportUrl({ item, game, version: VERSION }),
  };
}

/**
 * Where to read more about an item. With `report`, a last link tells of a mistake in what the game says
 * about it: where an answer has just been given, which is when a mistake is noticed.
 */
export function StudyLinks({ item, extra, report }: { item: Item; extra?: StudyLink[]; report?: boolean }) {
  const game = useStore((s) => (report ? s.game : null));
  return (
    <div className="links" aria-label={L(`Aprende más sobre ${item.name}`, `Learn more about ${item.name}`)}>
      {linksFor(item).map((l) => (
        <LinkPill key={l.kind} link={l} />
      ))}
      {extra?.map((l) => (
        <LinkPill key={l.href} link={l} />
      ))}
      {report && <LinkPill link={reportLink(item, game)} />}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-dot" aria-hidden="true" />
      <span>{label ?? L('Cargando…', 'Loading…')}</span>
    </div>
  );
}

export function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
