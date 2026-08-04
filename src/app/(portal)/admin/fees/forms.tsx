"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui";
import { SubmitButton, TextInput } from "@/components/form";
import { uploadFeeBalances, type FeeState } from "./actions";

const TEMPLATE = "admission_no,balance\nGS/2026/001,0\nGS/2026/002,4500\n";

export function FeeUploadForm() {
  const [state, action] = useActionState<FeeState, FormData>(uploadFeeBalances, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && <Alert tone="success">{state.ok}</Alert>}

      {state?.unmatched && state.unmatched.length > 0 && (
        <Alert tone="warning">
          {state.unmatched.length} row{state.unmatched.length === 1 ? "" : "s"} did not match a
          learner and {state.unmatched.length === 1 ? "was" : "were"} skipped:{" "}
          {state.unmatched.slice(0, 10).join(", ")}
          {state.unmatched.length > 10 ? ` and ${state.unmatched.length - 10} more` : ""}.
        </Alert>
      )}

      <p className="text-sm text-[var(--color-ink-soft)]">
        Two columns:{" "}
        <code className="rounded bg-[var(--color-surface-dark)] px-1.5 py-0.5 text-[0.8125rem]">
          admission_no, balance
        </code>
        . Amounts may include commas or a currency prefix.{" "}
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
          download="grace-fee-balances-template.csv"
          className="font-semibold text-[var(--color-crimson)] underline underline-offset-4"
        >
          Download a template
        </a>
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="file" className="text-sm font-semibold text-[var(--color-ink)]">
            Balances file (.csv)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="min-h-[44px] rounded-lg border border-[var(--color-line-strong)] bg-white
                       px-3.5 py-2.5 text-base file:mr-3 file:rounded-md file:border-0
                       file:bg-[var(--color-surface-dark)] file:px-3 file:py-2
                       file:text-sm file:font-semibold
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-[var(--color-crimson)]"
          />
        </div>

        <TextInput
          label="Correct as of"
          name="as_of"
          type="date"
          defaultValue={today}
          hint="Shown to parents next to the figure."
          required
        />
      </div>

      <div>
        <SubmitButton pendingLabel="Uploading...">Upload balances</SubmitButton>
      </div>
    </form>
  );
}
