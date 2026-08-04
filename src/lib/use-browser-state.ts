"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe as subscribeQueue,
  getCountSnapshot,
  getServerCountSnapshot,
} from "@/lib/register-queue";

/**
 * Browser state read through useSyncExternalStore rather than copied into
 * useState from an effect.
 *
 * Connectivity and the pending-register queue both live outside React. Mirroring
 * them into state on mount tears during hydration and trips React 19's
 * set-state-in-effect rule, which is correct: this is the API for the job.
 */

function subscribeOnline(fn: () => void): () => void {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
}

const getOnline = () => navigator.onLine;
// Assume connected on the server: an offline warning that flashes on every
// first paint would train teachers to ignore it.
const getOnlineServer = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnline, getOnlineServer);
}

export function usePendingRegisterCount(): number {
  return useSyncExternalStore(subscribeQueue, getCountSnapshot, getServerCountSnapshot);
}
