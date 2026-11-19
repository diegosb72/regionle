import { describe, expect, it, vi } from 'vitest';
import { canFullscreen, isFullscreen, toggleFullscreen } from './fullscreen';

type Fake = Parameters<typeof canFullscreen>[0];

/** A page as a browser gives it: with the standard full screen, with the one of old Safari, or with none. */
function page(kind: 'standard' | 'webkit' | 'none', enabled = true) {
  const state = { el: null as unknown };
  const root: Record<string, unknown> = {};
  const doc: Record<string, unknown> = { documentElement: root };
  if (kind === 'standard') {
    root.requestFullscreen = vi.fn(async () => void (state.el = root));
    doc.exitFullscreen = vi.fn(async () => void (state.el = null));
    doc.fullscreenEnabled = enabled;
    Object.defineProperty(doc, 'fullscreenElement', { get: () => state.el });
  } else if (kind === 'webkit') {
    root.webkitRequestFullscreen = vi.fn(() => void (state.el = root));
    doc.webkitExitFullscreen = vi.fn(() => void (state.el = null));
    doc.webkitFullscreenEnabled = enabled;
    Object.defineProperty(doc, 'webkitFullscreenElement', { get: () => state.el });
  }
  return { doc: doc as unknown as Fake, root, raw: doc };
}

describe('full screen', () => {
  it('is offered where the browser has it and grants it', () => {
    expect(canFullscreen(page('standard').doc)).toBe(true);
    expect(canFullscreen(page('webkit').doc)).toBe(true);
    expect(canFullscreen(page('none').doc)).toBe(false);
    // A page inside a frame that was not allowed to, or a phone that never does.
    expect(canFullscreen(page('standard', false).doc)).toBe(false);
    expect(canFullscreen(page('webkit', false).doc)).toBe(false);
  });

  it('goes in with one call and out with the next', async () => {
    for (const kind of ['standard', 'webkit'] as const) {
      const { doc, root, raw } = page(kind);
      expect(isFullscreen(doc)).toBe(false);
      await toggleFullscreen(doc);
      expect(isFullscreen(doc)).toBe(true);
      expect(root[kind === 'standard' ? 'requestFullscreen' : 'webkitRequestFullscreen']).toHaveBeenCalledTimes(1);
      await toggleFullscreen(doc);
      expect(isFullscreen(doc)).toBe(false);
      expect(raw[kind === 'standard' ? 'exitFullscreen' : 'webkitExitFullscreen']).toHaveBeenCalledTimes(1);
    }
  });

  it('leaves the page as it is when the browser refuses', async () => {
    const { doc, root } = page('standard');
    root.requestFullscreen = vi.fn(async () => {
      throw new TypeError('Permissions check failed');
    });
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
    expect(isFullscreen(doc)).toBe(false);
  });

  it('does nothing where there is no full screen to ask for', async () => {
    const { doc } = page('none');
    await expect(toggleFullscreen(doc)).resolves.toBeUndefined();
    expect(isFullscreen(doc)).toBe(false);
  });
});
