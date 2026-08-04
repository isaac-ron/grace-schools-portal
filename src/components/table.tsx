import type { ReactNode } from "react";

/**
 * Table primitives.
 *
 * Wide content scrolls inside its own container so the page body never scrolls
 * sideways, which is the difference between usable and useless when an admin
 * opens a class list on a phone.
 */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full min-w-[36rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={`border-b border-line bg-surface px-4 py-3
                  text-sm font-semibold text-ink-soft text-${align}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  muted = false,
  numeric = false,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <td
      className={`border-b border-line px-4 py-3 text-base text-${align}
                  ${muted ? "text-ink-soft" : "text-ink"}
                  ${numeric ? "tabular" : ""}`}
    >
      {children}
    </td>
  );
}

export function Tr({ children }: { children: ReactNode }) {
  return (
    <tr className="transition-colors duration-150 last:[&>td]:border-b-0 hover:bg-surface">
      {children}
    </tr>
  );
}

/** Neutral status pill. Distinct from LevelBadge, which carries CBE meaning. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "alert" | "info";
}) {
  const tones = {
    neutral:
      "border-line-strong bg-surface text-ink-soft",
    ok: "border-ok bg-ok-tint text-ok",
    warn: "border-warn bg-warn-tint text-warn",
    alert: "border-alert bg-alert-tint text-alert",
    info: "border-info bg-info-tint text-info",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Page-level heading with an action slot on the right. */
export function Toolbar({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-balance text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 sm:p-6">
      {title && (
        <div className="mb-5">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 max-w-prose text-sm text-ink-soft">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
