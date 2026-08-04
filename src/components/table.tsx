import type { ReactNode } from "react";

/**
 * Table primitives.
 *
 * Wide content scrolls inside its own container so the page body never scrolls
 * sideways, which is the difference between usable and useless when an admin
 * opens a class list on a phone.
 *
 * Under Crest a table is a ruled record, not a card: hairlines between rows,
 * a rule above and below the whole thing, and no box drawn around it.
 */

/* Alignment has to resolve to a literal class name. Building it as `text-${align}`
   leaves Tailwind's scanner nothing to find, so the utility only exists as long as
   some unrelated file happens to use it. */
const alignments = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

type Align = keyof typeof alignments;

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border-y border-line bg-card">
      <table className="w-full min-w-[36rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: Align;
}) {
  return (
    <th
      scope="col"
      className={`doc-label border-b border-line bg-surface px-4 py-3 ${alignments[align]}`}
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
  align?: Align;
  muted?: boolean;
  numeric?: boolean;
}) {
  return (
    <td
      className={`border-b border-line px-4 py-3 text-base ${alignments[align]}
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
    neutral: "border-line-strong bg-surface text-ink-soft",
    ok: "border-ok bg-ok-tint text-ok",
    warn: "border-warn bg-warn-tint text-warn",
    alert: "border-alert bg-alert-tint text-alert",
    info: "border-info bg-info-tint text-info",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-xs border px-2.5 py-1 text-xs font-bold tracking-wide ${tones[tone]}`}
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
    <div className="rule-gold mb-6 flex flex-col gap-4 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl text-balance text-ink">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/**
 * A section of a record.
 *
 * Ruled, not boxed. Cards stacked inside a page were the old default and they
 * made every screen read as a dashboard; a school record reads as a document
 * with sections, so the section announces itself with a heading and a hairline.
 */
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
    <section className="border-y border-line bg-card p-5 sm:p-6">
      {title && (
        <div className="mb-5 border-b border-line pb-3">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          {description && (
            <p className="mt-1 max-w-prose text-sm text-ink-soft">{description}</p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
