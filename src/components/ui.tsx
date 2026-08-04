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
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-crimson text-white hover:bg-crimson-dark active:bg-crimson-dark",
  secondary:
    "bg-white text-ink border border-line-strong hover:bg-surface active:bg-surface-dark",
  destructive:
    "bg-alert text-white hover:brightness-95 active:brightness-90",
  ghost:
    "bg-transparent text-ink-soft hover:bg-surface-dark active:bg-surface-dark",
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
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-ink-soft">
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
          "min-h-[44px] rounded-lg border bg-white px-3.5 text-base text-ink",
          "placeholder:text-ink-soft",
          "transition-colors duration-150",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson",
          "disabled:bg-surface disabled:cursor-not-allowed",
          error
            ? "border-alert"
            : "border-line-strong focus:border-crimson",
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm font-medium text-alert">
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
  error: "bg-alert-tint text-alert border-alert",
  warning: "bg-warn-tint text-warn border-warn",
  success: "bg-ok-tint text-ok border-ok",
  info: "bg-info-tint text-info border-info",
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
                   border-level-na bg-level-na-tint
                   text-level-na"
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
    ee: "border-level-ee bg-level-ee-tint text-level-ee",
    me: "border-level-me bg-level-me-tint text-level-me",
    ae: "border-level-ae bg-level-ae-tint text-level-ae",
    be: "border-level-be bg-level-be-tint text-level-be",
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
    <div className="rounded-xl border border-dashed border-line-strong bg-white px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-sm text-ink-soft">
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
          subdued ? "text-white" : "text-crimson",
        )}
      >
        The Grace Schools
      </span>
      <span
        className={cx(
          "mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
          subdued ? "text-white/70" : "text-ink-muted",
        )}
      >
        Portal
      </span>
    </span>
  );
}
