import { describe, expect, it, vi } from 'vitest';
import { lazyScreen } from './lazy';

const Part = () => null;

describe('code that is fetched apart', () => {
  it('is not here until it has been fetched, and is fetched once however many times it is asked for', async () => {
    const load = vi.fn(() => Promise.resolve(Part));
    const screen = lazyScreen(load);
    expect(screen.here()).toBe(false);
    expect(load).not.toHaveBeenCalled();

    screen.warm();
    const ready = screen.ready();
    expect(screen.here()).toBe(false);
    await ready;
    expect(screen.here()).toBe(true);
    await screen.ready();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing to wait for when the code does not come, and asks again the next time', async () => {
    const load = vi.fn<() => Promise<typeof Part>>(() => Promise.reject(new Error('sin conexión')));
    const screen = lazyScreen(load);
    // Whoever waits is told it is over, not that it went wrong: the page is drawn without that part.
    await expect(screen.ready()).resolves.toBeUndefined();
    expect(screen.here()).toBe(true);

    load.mockImplementation(() => Promise.resolve(Part));
    await screen.ready();
    expect(load).toHaveBeenCalledTimes(2);
    expect(screen.here()).toBe(true);
  });
});
