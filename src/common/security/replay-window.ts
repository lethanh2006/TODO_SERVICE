interface Entry {
  key: string;
  expiresAt: number;
}

/** Exact expiry in arrival-independent order; never evict an unexpired key. */
export class ReplayWindow {
  private readonly keys = new Set<string>();
  private readonly heap: Entry[] = [];

  constructor(private readonly maxEntries = 100_000) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1)
      throw new Error('Invalid replay window capacity');
  }

  remember(key: string, expiresAt: number, now: number): boolean {
    this.prune(now);
    if (this.keys.has(key)) return false;
    if (this.keys.size >= this.maxEntries) throw new ReplayWindowFull();
    this.keys.add(key);
    const entry = { key, expiresAt };
    let index = this.heap.length;
    this.heap.push(entry);
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (this.heap[parent].expiresAt <= expiresAt) break;
      this.heap[index] = this.heap[parent];
      index = parent;
    }
    this.heap[index] = entry;
    return true;
  }

  private prune(now: number): void {
    // Timestamp validation accepts the exact boundary; retain replay protection there.
    while (this.heap.length && this.heap[0].expiresAt < now) {
      this.keys.delete(this.heap[0].key);
      const last = this.heap.pop()!;
      if (!this.heap.length) break;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= this.heap.length) break;
        const right = left + 1;
        const child =
          right < this.heap.length &&
          this.heap[right].expiresAt < this.heap[left].expiresAt
            ? right
            : left;
        if (this.heap[child].expiresAt >= last.expiresAt) break;
        this.heap[index] = this.heap[child];
        index = child;
      }
      this.heap[index] = last;
    }
  }
}

export class ReplayWindowFull extends Error {}
