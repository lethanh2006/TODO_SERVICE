import { ReplayWindow, ReplayWindowFull } from './replay-window';

describe('Replay protection expiry', () => {
  it('rejects a replay at the exact timestamp boundary', () => {
    const window = new ReplayWindow(2);
    expect(window.remember('first', 1000, 0)).toBe(true);
    expect(window.remember('first', 2000, 1000)).toBe(false);
    expect(window.remember('first', 3000, 1001)).toBe(true);
  });
  it('expires out-of-order timestamps without discarding live signatures', () => {
    const window = new ReplayWindow(3);
    window.remember('future', 9000, 0);
    window.remember('old', 1000, 0);
    window.remember('middle', 5000, 0);
    expect(window.remember('new', 6000, 1001)).toBe(true);
    expect(window.remember('future', 10000, 1001)).toBe(false);
    expect(() => window.remember('full', 10000, 1001)).toThrow(
      ReplayWindowFull,
    );
    expect(window.remember('another', 10000, 6001)).toBe(true);
    expect(window.remember('future', 10000, 6001)).toBe(false);
  });
  it('keeps every live signature when capacity is reached', () => {
    const window = new ReplayWindow(1);
    window.remember('first', 1000, 0);
    expect(() => window.remember('second', 2000, 0)).toThrow(ReplayWindowFull);
    expect(window.remember('first', 2000, 0)).toBe(false);
    expect(window.remember('second', 2000, 1001)).toBe(true);
  });
  it('matches a reference set under mixed expiry order', () => {
    const window = new ReplayWindow(1000);
    const reference = new Map<string, number>();
    for (let now = 0; now < 2000; now++) {
      for (const [key, expiry] of reference)
        if (expiry < now) reference.delete(key);
      const key = String((now * 17) % 91);
      const expiry = now + ((now * 13) % 100);
      const accepted = !reference.has(key);
      expect(window.remember(key, expiry, now)).toBe(accepted);
      if (accepted) reference.set(key, expiry);
    }
  });
});
