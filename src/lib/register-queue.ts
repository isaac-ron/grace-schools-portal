import type { RegisterPayload } from "@/app/(portal)/teacher/register/actions";

/**
 * A pending-register queue in localStorage.
 *
 * This is deliberately NOT an offline-first sync engine. The scope calls for
 * resilience, not offline architecture, and the difference matters: a service
 * worker with a background sync queue is weeks of work and a whole class of new
 * bugs, while this is a keyed map that survives a dropped connection, a closed
 * tab, and a dead battery.
 *
 * Keyed by class and date, so re-marking the same register replaces the pending
 * copy rather than stacking duplicates. The server call is an idempotent upsert,
 * so flushing twice is harmless.
 */

const KEY = "grace.pendingRegisters.v1";

export type PendingRegister = {
  payload: RegisterPayload;
  queuedAt: number;
  attempts: number;
  lastError?: string;
};

type Store = Record<string, PendingRegister>;

const keyFor = (p: RegisterPayload) => `${p.class_id}|${p.date}`;

/* --------------------------------------------------------------------------
 * Subscription
 *
 * The queue is external state, so components read it with useSyncExternalStore
 * rather than copying it into useState from an effect. `storage` fires for other
 * tabs; the local notify covers this one.
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  for (const fn of listeners) fn();
}

/** Snapshot must be a stable primitive, or useSyncExternalStore re-renders forever. */
export function getCountSnapshot(): number {
  return Object.keys(read()).length;
}

/** localStorage does not exist during server render. */
export function getServerCountSnapshot(): number {
  return 0;
}

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    // Corrupt or unavailable storage (private mode, quota). Losing the queue is
    // recoverable; crashing the register is not.
    return {};
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: the in-memory submit still proceeds */
  }
}

export function enqueue(payload: RegisterPayload, error?: string) {
  const store = read();
  const k = keyFor(payload);
  const existing = store[k];
  store[k] = {
    payload,
    queuedAt: existing?.queuedAt ?? Date.now(),
    attempts: (existing?.attempts ?? 0) + 1,
    lastError: error,
  };
  write(store);
  notify();
}

export function dequeue(payload: RegisterPayload) {
  const store = read();
  delete store[keyFor(payload)];
  write(store);
  notify();
}

export function list(): PendingRegister[] {
  return Object.values(read()).sort((a, b) => a.queuedAt - b.queuedAt);
}

export function pendingFor(classId: string, date: string): PendingRegister | undefined {
  return read()[`${classId}|${date}`];
}

export function count(): number {
  return Object.keys(read()).length;
}
