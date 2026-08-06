// Server-side timing for API routes that call Prognosis.
//
// The portal's perceived slowness has two possible sources — our own JS/render
// cost, and upstream Prognosis latency — and they need different fixes. This
// logs one line per request with a per-call breakdown so the split is visible
// in Render's logs without wiring up an APM.
//
// Example output:
//   [perf] hr/claims total=2841ms cache=MISS premium=612ms claims+header=2103ms rows=1204

export interface RouteTimer {
  /** Times a single upstream call (or any promise) under a short label. */
  track<T>(name: string, work: Promise<T>): Promise<T>;
  /** Notes a value to include in the log line, e.g. cache status or row count. */
  note(key: string, value: string | number): void;
  /** Emits the log line. Safe to call once per request, in a finally block. */
  done(): void;
}

export function createTimer(label: string): RouteTimer {
  const start = Date.now();
  const marks: string[] = [];
  const notes: string[] = [];

  return {
    async track<T>(name: string, work: Promise<T>): Promise<T> {
      const t0 = Date.now();
      try {
        return await work;
      } finally {
        marks.push(`${name}=${Date.now() - t0}ms`);
      }
    },
    note(key, value) {
      notes.push(`${key}=${value}`);
    },
    done() {
      const parts = [`total=${Date.now() - start}ms`, ...notes, ...marks];
      console.log(`[perf] ${label} ${parts.join(' ')}`);
    },
  };
}
