"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Form primitives for the admin surfaces.
 *
 * Admin runs on a laptop in the school office, so these are denser than the
 * parent-facing controls, but the 44px target and 16px input text are kept:
 * the same people also open this on a phone.
 */

export type ActionState =
  | { ok?: string; error?: string; fieldErrors?: Record<string, string[]> }
  | undefined;

const controlBase =
  "min-h-[44px] w-full rounded-lg border bg-white px-3.5 text-base text-ink " +
  "transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson " +
  "disabled:bg-surface disabled:cursor-not-allowed";

function borderFor(error?: string) {
  return error
    ? "border-alert"
    : "border-line-strong focus:border-crimson";
}

function Wrapper({
  label,
  name,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-alert" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${name}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${name}-error`} className="text-sm font-medium text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
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
  return (
    <Wrapper label={label} name={name} hint={hint} error={error} required={props.required}>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined
        }
        className={`${controlBase} ${borderFor(error)}`}
        {...props}
      />
    </Wrapper>
  );
}

export function SelectInput({
  label,
  name,
  hint,
  error,
  options,
  placeholder,
  ...props
}: Omit<ComponentProps<"select">, "children"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Wrapper label={label} name={name} hint={hint} error={error} required={props.required}>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={`${controlBase} ${borderFor(error)}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function TextArea({
  label,
  name,
  hint,
  error,
  ...props
}: ComponentProps<"textarea"> & {
  label: string;
  name: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Wrapper label={label} name={name} hint={hint} error={error} required={props.required}>
      <textarea
        id={name}
        name={name}
        rows={4}
        aria-invalid={error ? true : undefined}
        className={`${controlBase} py-2.5 ${borderFor(error)}`}
        {...props}
      />
    </Wrapper>
  );
}

export function CheckboxInput({
  label,
  name,
  hint,
  ...props
}: ComponentProps<"input"> & { label: string; name: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-line-strong
                   accent-crimson
                   focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-crimson"
        {...props}
      />
      <div className="flex flex-col">
        <label htmlFor={name} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {hint && <p className="text-sm text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

/** Submit button that reflects pending state without the caller wiring it up. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? (pendingLabel ?? "Saving...") : children}
    </Button>
  );
}

/**
 * Destructive submit with a confirmation step.
 *
 * A modal would be the reflex here. An inline confirm is cheaper, works without
 * JavaScript falling back to a plain submit, and keeps the row in view.
 */
export function ConfirmSubmit({
  children,
  confirm,
  pendingLabel,
}: {
  children: ReactNode;
  confirm: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? (pendingLabel ?? "Working...") : children}
    </Button>
  );
}
