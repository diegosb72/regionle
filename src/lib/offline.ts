/**
 * Installed application and play without a connection: registers the service worker, tells when a new
 * version is waiting, and downloads every map into the browser's cache when the player asks for it.
 */
import { useSyncExternalStore } from 'react';

/** Same name as in the service worker (scripts/pwa/sw.js). */
const DATA_CACHE = 'regionle-data';
const PACK_KEY = 'regionle:pack';
const BASE = import.meta.env.BASE_URL;

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface OfflineState {
  /** The browser can keep the application and it has been built for it (not while developing). */
  supported: boolean;
  /** A new version is installed and waiting for the player's go-ahead. */
  update: boolean;
  /** The browser offers to install the application. */
  installable: boolean;
}

let state: OfflineState = { supported: false, update: false, installable: false };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | null = null;
let installEvent: InstallEvent | null = null;
let reloadWanted = false;

function set(patch: Partial<OfflineState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

export function useOffline(): OfflineState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

/** Call once at start-up. Does nothing while developing: the worker only exists in a built site. */
export function registerOffline(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallEvent;
    set({ installable: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    set({ installable: false });
  });
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !('caches' in window)) return;
  set({ supported: true });

  const sw = navigator.serviceWorker;
  // A worker taking over for the first time changes nothing on screen; a replacement asked for by the player reloads the page.
  sw.addEventListener('controllerchange', () => {
    if (!reloadWanted) return;
    reloadWanted = false;
    window.location.reload();
  });

  const watch = (worker: ServiceWorker | null) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && sw.controller) set({ update: true });
    });
  };
  const start = async () => {
    try {
      const reg = await sw.register(`${BASE}sw.js`);
      registration = reg;
      if (reg.waiting && sw.controller) set({ update: true });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // A page left open for days still finds out about new versions.
      window.setInterval(() => void reg.update().catch(() => undefined), 3_600_000);
    } catch {
      set({ supported: false });
    }
  };
  if (document.readyState === 'complete') void start();
  else window.addEventListener('load', () => void start(), { once: true });
}

/** Switches to the version that is waiting and reloads the page. */
export function applyUpdate(): void {
  const waiting = registration?.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  reloadWanted = true;
  waiting.postMessage('skip-waiting');
}

/** Shows the browser's own "install" dialogue. */
export async function promptInstall(): Promise<void> {
  const e = installEvent;
  if (!e) return;
  installEvent = null;
  set({ installable: false });
  try {
    await e.prompt();
    await e.userChoice;
  } catch {
    // Dismissed: nothing to do.
  }
}

// ----------------------------------------------------------------- download

export interface Pack {
  /** Changes when any map does. */
  dv: string;
  /** Weight of the download once compressed. */
  bytes: number;
  files: string[];
}

export type PackStatus = { kind: 'none' | 'partial' | 'full' | 'stale'; have: number; total: number };

let packPromise: Promise<Pack | null> | null = null;

/** What there is to download; null when the site was not built for it. */
export function loadPack(): Promise<Pack | null> {
  packPromise ??= fetch(`${BASE}offline.json`)
    .then((res) => (res.ok ? (res.json() as Promise<Pack>) : null))
    .then((p) => (p && Array.isArray(p.files) ? p : null))
    .catch(() => null);
  return packPromise;
}

const abs = (file: string): string => new URL(`${BASE}${file}`, document.baseURI).href;

export async function packStatus(pack: Pack): Promise<PackStatus> {
  const cache = await caches.open(DATA_CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url.split('?')[0]));
  const n = pack.files.filter((f) => have.has(abs(f))).length;
  const total = pack.files.length;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(PACK_KEY);
  } catch {
    // Private mode: treated as never downloaded.
  }
  if (n < total) return { kind: saved ? 'partial' : 'none', have: n, total };
  return { kind: saved === pack.dv ? 'full' : 'stale', have: n, total };
}

/**
 * Fetches every file into the cache, a few at a time. Resolves with the number that failed; what was
 * already stored is asked again, so that an old download is brought up to date.
 */
export async function downloadPack(pack: Pack, onProgress: (done: number, total: number) => void, signal?: AbortSignal): Promise<number> {
  const cache = await caches.open(DATA_CACHE);
  const total = pack.files.length;
  let next = 0;
  let done = 0;
  let failed = 0;
  onProgress(0, total);
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (next < total && !signal?.aborted) {
        const url = abs(pack.files[next++]);
        try {
          const res = await fetch(url, { cache: 'no-cache', signal });
          if (!res.ok) throw new Error(String(res.status));
          await cache.put(url, res);
        } catch {
          failed++;
        }
        onProgress(++done, total);
      }
    }),
  );
  if (signal?.aborted) return total - done + failed;
  if (!failed) {
    try {
      localStorage.setItem(PACK_KEY, pack.dv);
    } catch {
      // Nothing to do: the status will read "partial".
    }
    // Ask the browser not to throw the maps away when it runs short of space.
    void navigator.storage?.persist?.().catch(() => undefined);
  }
  return failed;
}

/** Frees the space taken by the download. */
export async function clearPack(): Promise<void> {
  await caches.delete(DATA_CACHE);
  try {
    localStorage.removeItem(PACK_KEY);
  } catch {
    // Nothing stored.
  }
}
