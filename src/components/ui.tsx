import type { ComponentProps, ReactNode } from "react";

/**
 * Shared primitives. One button shape, one field shape, one badge shape across
 * the whole portal: a control that looks different on two screens means one of
 * them is wrong.
 *
 * No icon or component library. Page weight is a cost the parent pays in mobile
 * data, so the few icons here are inline SVG.
 */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "min-h-[44px] px-5 text-base transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-crimson)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-crimson)] text-white hover:bg-[var(--color-crimson-dark)] active:bg-[var(--color-crimson-dark)]",
  secondary:
    "bg-white text-[var(--color-ink)] border border-[var(--color-line-strong)] hover:bg-[var(--color-surface)] active:bg-[var(--color-surface-dark)]",
  destructive:
    "bg-[var(--color-alert)] text-white hover:brightness-95 active:brightness-90",
  ghost:
    "bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-dark)] active:bg-[var(--color-surface-dark)]",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button className={cx(buttonBase, buttonVariants[variant], className)} {...props}>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Form field                                                                  */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  name,
  hint,
  error,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-[var(--color-ink-soft)]">
          {hint}
        </p>
      )}
      <input
        id={name}
        name={name}
        aria-describedby={cx(hintId, errorId) || undefined}
        aria-invalid={error ? true : undefined}
        /* 16px minimum: anything smaller triggers zoom-on-focus on mobile. */
        className={cx(
          "min-h-[44px] rounded-lg border bg-white px-3.5 text-base text-[var(--color-ink)]",
          "placeholder:text-[var(--color-ink-soft)]",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-crimson)]",
          "disabled:bg-[var(--color-surface)] disabled:cursor-not-allowed",
          error
            ? "border-[var(--color-alert)]"
            : "border-[var(--color-line-strong)] focus:border-[var(--color-crimson)]",
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm font-medium text-[var(--color-alert)]">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                       */
/* -------------------------------------------------------------------------- */

const alertTones = {
  error: "bg-[var(--color-alert-tint)] text-[var(--color-alert)] border-[var(--color-alert)]",
  warning: "bg-[var(--color-warn-tint)] text-[var(--color-warn)] border-[var(--color-warn)]",
  success: "bg-[var(--color-ok-tint)] text-[var(--color-ok)] border-[var(--color-ok)]",
  info: "bg-[var(--color-info-tint)] text-[var(--color-info)] border-[var(--color-info)]",
} as const;

export function Alert({
  tone = "info",
  children,
}: {
  tone?: keyof typeof alertTones;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-lg border px-4 py-3 text-sm font-medium",
        alertTones[tone],
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Achievement level badge                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Renders a CBE achievement level.
 *
 * Two rules encoded here, both from DESIGN.md:
 *   - The code always appears as text. Colour is never the only signal.
 *   - `null` means not assessed, which is slate and reads "Not assessed". It is
 *     deliberately not the bottom grade: a learner who missed an assessment has
 *     not earned Below Expectation, and conflating them misrepresents a child on
 *     a document their parents keep.
 */
export function LevelBadge({ code }: { code: string | null }) {
  if (!code) {
    return (
      <span
        className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold
                   border-[var(--color-level-na)] bg-[var(--color-level-na-tint)]
                   text-[var(--color-level-na)]"
      >
        Not assessed
      </span>
    );
  }

  const family = code.startsWith("EE")
    ? "ee"
    : code.startsWith("ME")
      ? "me"
      : code.startsWith("AE")
        ? "ae"
        : "be";

  const tones: Record<string, string> = {
    ee: "border-[var(--color-level-ee)] bg-[var(--color-level-ee-tint)] text-[var(--color-level-ee)]",
    me: "border-[var(--color-level-me)] bg-[var(--color-level-me-tint)] text-[var(--color-level-me)]",
    ae: "border-[var(--color-level-ae)] bg-[var(--color-level-ae-tint)] text-[var(--color-level-ae)]",
    be: "border-[var(--color-level-be)] bg-[var(--color-level-be-tint)] text-[var(--color-level-be)]",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold tabular",
        tones[family],
      )}
    >
      {code}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

/** Teaches the interface rather than announcing absence. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line-strong)] bg-white px-6 py-10 text-center">
      <p className="text-lg font-semibold text-[var(--color-ink)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-sm text-[var(--color-ink-soft)]">
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Wordmark                                                                    */
/* -------------------------------------------------------------------------- */

/** The one place Playfair appears. Identity, never a control. */
export function Wordmark({ subdued = false }: { subdued?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={cx(
          "font-display text-lg font-bold tracking-tight",
          subdued ? "text-white" : "text-[var(--color-crimson)]",
        )}
      >
        The Grace Schools
      </span>
      <span
        className={cx(
          "mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
          subdued ? "text-white/70" : "text-[var(--color-ink-muted)]",
        )}
      >
        Portal
      </span>
    </span>
  );
}
