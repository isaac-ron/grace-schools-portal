"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { list, dequeue, enqueue } from "@/lib/register-queue";
import { usePendingRegisterCount } from "@/lib/use-browser-state";
import { saveRegister } from "./register/actions";

/**
 * Surfaces registers still sitting on this device, and retries them.
 *
 * It lives on the teacher's home page so an unsent register is visible from the
 * first screen after signing in, rather than only on the page it was marked on.
 * A teacher who marked a register in a dead spot and closed the tab would
 * otherwise have no way to know it never arrived.
 */
export function PendingRegisterNotice() {
  const pending = usePendingRegisterCount();
  const [sent, setSent] = useState(0);
  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    let delivered = 0;
    try {
      for (const item of list()) {
        try {
          const res = await saveRegister(item.payload);
          if (res.ok) {
            dequeue(item.payload);
            delivered++;
          } else {
            enqueue(item.payload, res.error);
          }
        } catch {
          break; // still offline
        }
      }
    } finally {
      flushing.current = false;
      if (delivered) setSent((n) => n + delivered);
    }
  }, []);

  useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  if (pending === 0 && sent === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {sent > 0 && (
        <Alert tone="success">
          {sent} register{sent === 1 ? "" : "s"} that had been waiting on this device
          {sent === 1 ? " has" : " have"} now been sent.
        </Alert>
      )}
      {pending > 0 && (
        <Alert tone="warning">
          {pending} register{pending === 1 ? "" : "s"} saved on this device but not yet
          sent. This retries automatically when the connection returns. Keep using
          this device and phone until it clears.
        </Alert>
      )}
    </div>
  );
}
