/**
 * GKT Platform Adapter (stub)
 *
 * Will use system.js SYSTEM global + GKTKiosk bridge.
 * For now, this is a skeleton that satisfies the interface.
 * Actual implementation happens in Phase 1-4.
 */

import type { PlatformAdapter } from '../adapter';
import { WebAdapterBase } from '../webAdapterBase';

// SYSTEM is a global injected by system.js (loaded in index.html)
declare const SYSTEM: {
  registerNfc(callback: (payload: unknown) => void): void;
  log2(facility: string, msg: string): void;
};

/**
 * Normalize NFC payload from system.js into a platform-agnostic scan event.
 *
 * system.js delivers scans via two paths with different payload shapes:
 * 1. Intent-path: {uid: "f0:bc:e8:44", eventSource: "NFC", eventNumber: N}
 * 2. Sensor-path: {eventSource: "nfc", barcode: "f0:bc:e8:44"}
 * 3. Legacy string: "f0:bc:e8:44"
 */
/**
 * Extract a tag ID and (when available) hardware-provided scan identity
 * from the raw system.js NFC payload.
 *
 * Returns `{ tagId, eventNumber? }` so the caller can decide how to
 * assign a scanId (hardware eventNumber vs. fallback counter).
 */
export function normalizeNfcPayload(
  payload: unknown
): { tagId: string; eventNumber: number | null } | null {
  if (typeof payload === 'string') {
    return { tagId: payload.toUpperCase(), eventNumber: null };
  }

  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    const eventNumber =
      typeof obj.eventNumber === 'number' &&
      Number.isSafeInteger(obj.eventNumber) &&
      obj.eventNumber >= 0
        ? obj.eventNumber
        : null;

    // Intent-path: {uid: "f0:bc:e8:44", eventSource: "NFC"}
    if (typeof obj.uid === 'string' && obj.uid) {
      return { tagId: obj.uid.toUpperCase(), eventNumber };
    }

    // Sensor-path: {eventSource: "nfc", barcode: "f0:bc:e8:44"}
    if (typeof obj.barcode === 'string' && obj.barcode) {
      return { tagId: obj.barcode.toUpperCase(), eventNumber };
    }
  }

  return null;
}

// Worst measured cost of one native log call, and the longest an entry waits.
const LOG_WRITE_MAX_MS = 8;
const LOG_FLUSH_MAX_DELAY_MS = 1000;

class GKTAdapter extends WebAdapterBase implements PlatformAdapter {
  readonly platform = 'gkt' as const;

  private readonly logQueue: { entry: string; resolve: () => void }[] = [];
  private logFlushScheduled = false;

  constructor() {
    super();
    // A reload or shell restart must not lose the entries still in the buffer.
    window.addEventListener('pagehide', () => {
      while (this.logQueue.length > 0) this.writeNextLog();
      // The queue is empty; a still-pending idle callback finds nothing to write.
      this.logFlushScheduled = false;
    });
  }

  async initializeNfc(): Promise<void> {
    // Register NFC callback with system.js — handles all payload shapes.
    // GKT NFC fires once per physical tap (Android intent-based dispatch),
    // unlike MFRC522 which polls continuously. No adapter-level dedup needed —
    // every callback is a distinct scan.
    SYSTEM.registerNfc((payload: unknown) => {
      if (!this.scanCallback) return;

      const parsed = normalizeNfcPayload(payload);
      if (!parsed) return;

      this.scanCallback({
        tagId: parsed.tagId,
        // Keep hardware and local identities in separate numeric namespaces.
        // system.js eventNumber values are non-negative; missing identities use
        // negative local IDs so the two delivery paths cannot collide.
        scanId: parsed.eventNumber ?? -++this.scanCounter,
      });
    });
  }

  /**
   * Buffers the entry and writes it when the page is idle. A native log call
   * blocks the main thread for several milliseconds on the GKT hardware, so it
   * must not run inside a tap or scan handler. Resolves once the entry is written.
   */
  persistLog(entry: string): Promise<void> {
    return new Promise(resolve => {
      this.logQueue.push({ entry, resolve });
      this.scheduleLogFlush();
    });
  }

  private scheduleLogFlush(): void {
    if (this.logFlushScheduled) return;
    this.logFlushScheduled = true;
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(deadline => this.flushLogs(deadline), {
        timeout: LOG_FLUSH_MAX_DELAY_MS,
      });
    } else {
      setTimeout(() => this.flushLogs(), 0);
    }
  }

  /**
   * Writes queued entries while the idle period has room for one more native
   * call. Without idle time (forced by the timeout, or no idle API) it writes
   * a single entry, so a busy page is never held for more than one call.
   */
  private flushLogs(deadline?: IdleDeadline): void {
    this.logFlushScheduled = false;
    const hasIdleTime = deadline !== undefined && !deadline.didTimeout;
    do {
      this.writeNextLog();
    } while (
      this.logQueue.length > 0 &&
      hasIdleTime &&
      deadline.timeRemaining() >= LOG_WRITE_MAX_MS
    );
    if (this.logQueue.length > 0) this.scheduleLogFlush();
  }

  private writeNextLog(): void {
    const next = this.logQueue.shift();
    if (!next) return;
    try {
      SYSTEM.log2('PyrePortal', next.entry);
    } catch {
      // eslint-disable-next-line no-console
      console.log(next.entry);
    }
    next.resolve();
  }
}

export const adapter: PlatformAdapter = new GKTAdapter();
