"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { Pill } from "@/components/table";
import { saveRegister, type RegisterPayload } from "./actions";
import { dequeue, enqueue, list } from "@/lib/register-queue";
import { useOnline, usePendingRegisterCount } from "@/lib/use-browser-state";

type Learner = { id: string; admission_no: string; first_name: string; last_name: string };
type Status = "present" | "absent" | "late";
type Reason = "sick" | "permission" | "unexplained";

type Mark = { status: Status; reason: Reason | null };

const REASONS: { value: Reason; label: string }[] = [
  { value: "sick", label: "Sick" },
  { value: "permission", label: "With permission" },
  { value: "unexplained", label: "Unexplained" },
];

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "queued" }
  | { kind: "error"; message: string };

export function RegisterForm({
  classId,
  className,
  date,
  learners,
  existing,
}: {
  classId: string;
  className: string;
  date: string;
  learners: Learner[];
  existing: Record<string, Mark>;
}) {
  // Everyone starts Present. The teacher marks exceptions only, which is the
  // difference between a twenty second job and a two minute one.
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    const initial: Record<string, Mark> = {};
    for (const l of learners) {
      initial[l.id] = existing[l.id] ?? { status: "present", reason: null };
    }
    return initial;
  });

  const [state, setState] = useState<SaveState>({ kind: "idle" });
  // Both read straight from the browser rather than being mirrored into state.
  const online = useOnline();
  const queuedCount = usePendingRegisterCount();
  const flushing = useRef(false);

  const buildPayload = useCallback(
    (): RegisterPayload => ({
      class_id: classId,
      date,
      records: learners.map((l) => ({
        student_id: l.id,
        status: marks[l.id]?.status ?? "present",
        reason: marks[l.id]?.status === "absent" ? (marks[l.id]?.reason ?? "unexplained") : null,
      })),
    }),
    [classId, date, learners, marks],
  );

  /** Attempts every queued register. Safe to call repeatedly: the save upserts. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of list()) {
        try {
          const res = await saveRegister(item.payload);
          if (res.ok) dequeue(item.payload);
          else enqueue(item.payload, res.error);
        } catch {
          // Still unreachable. Leave it queued and stop trying for now.
          break;
        }
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  // Retry anything left over, on mount and whenever the connection returns.
  useEffect(() => {
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    void flush();
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  function setStatus(id: string, status: Status) {
    setMarks((m) => ({
      ...m,
      [id]: {
        status,
        reason: status === "absent" ? (m[id]?.reason ?? "unexplained") : null,
      },
    }));
  }

  function setReason(id: string, reason: Reason) {
    setMarks((m) => ({ ...m, [id]: { status: "absent", reason } }));
  }

  async function submit() {
    const payload = buildPayload();
    setState({ kind: "saving" });
    try {
      const res = await saveRegister(payload);
      if (res.ok) {
        dequeue(payload);
        setState({ kind: "saved", at: Date.now() });
      } else {
        setState({ kind: "error", message: res.error });
      }
    } catch {
      // Network failure rather than a rejected save. Keep it and retry later.
      enqueue(payload);
      setState({ kind: "queued" });
    }
  }

  const absent = learners.filter((l) => marks[l.id]?.status === "absent").length;
  const late = learners.filter((l) => marks[l.id]?.status === "late").length;
  const present = learners.length - absent - late;

  return (
    <div className="flex flex-col gap-5">
      {!online && (
        <Alert tone="warning">
          You are offline. You can still mark the register; it is saved on this
          device and sent automatically when the connection returns.
        </Alert>
      )}

      {state.kind === "queued" && (
        <Alert tone="warning">
          Saved on this device but not yet sent. It will go automatically when
          the connection returns. You can close this page.
        </Alert>
      )}
      {state.kind === "saved" && <Alert tone="success">Register saved.</Alert>}
      {state.kind === "error" && <Alert tone="error">{state.message}</Alert>}
      {queuedCount > 0 && state.kind !== "queued" && (
        <Alert tone="warning">
          {queuedCount} register{queuedCount === 1 ? "" : "s"} still waiting to send.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
        <span className="text-sm font-semibold text-ink">{className}</span>
        <span className="text-sm text-ink-soft tabular">{date}</span>
        <span className="ml-auto flex flex-wrap gap-2">
          <Pill tone="ok">{present} present</Pill>
          {late > 0 && <Pill tone="warn">{late} late</Pill>}
          {absent > 0 && <Pill tone="alert">{absent} absent</Pill>}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {learners.map((l) => {
          const mark = marks[l.id] ?? { status: "present", reason: null };
          return (
            <li
              key={l.id}
              className="rounded-xl border border-line bg-white p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {l.last_name}, {l.first_name}
                  </p>
                  <p className="text-sm text-ink-soft tabular">{l.admission_no}</p>
                </div>

                <div
                  role="radiogroup"
                  aria-label={`Attendance for ${l.first_name} ${l.last_name}`}
                  className="flex shrink-0 gap-2"
                >
                  {(["present", "late", "absent"] as Status[]).map((s) => {
                    const active = mark.status === s;
                    const tone =
                      s === "present"
                        ? "border-ok bg-ok text-white"
                        : s === "late"
                          ? "border-warn bg-warn text-white"
                          : "border-alert bg-alert text-white";
                    return (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setStatus(l.id, s)}
                        className={`min-h-[44px] min-w-[5.25rem] rounded-lg border px-3 text-sm font-semibold
                                    capitalize transition-colors duration-150
                                    focus-visible:outline-2 focus-visible:outline-offset-2
                                    focus-visible:outline-crimson
                                    ${
                                      active
                                        ? tone
                                        : "border-line-strong bg-white text-ink-soft hover:bg-surface"
                                    }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {mark.status === "absent" && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <span className="self-center text-sm text-ink-soft">Reason</span>
                  {REASONS.map((r) => {
                    const active = mark.reason === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setReason(l.id, r.value)}
                        className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium
                                    transition-colors duration-150
                                    focus-visible:outline-2 focus-visible:outline-offset-2
                                    focus-visible:outline-crimson
                                    ${
                                      active
                                        ? "border-crimson bg-crimson-tint text-crimson"
                                        : "border-line-strong bg-white text-ink-soft"
                                    }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Sticky so a teacher with forty learners never has to scroll to save. */}
      <div className="sticky bottom-16 z-20 rounded-xl border border-line bg-white p-4 shadow-lg lg:bottom-4">
        <Button onClick={submit} disabled={state.kind === "saving"} className="w-full">
          {state.kind === "saving" ? "Saving..." : "Save register"}
        </Button>
      </div>
    </div>
  );
}
