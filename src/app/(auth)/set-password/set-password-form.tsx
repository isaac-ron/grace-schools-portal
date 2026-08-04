"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPassword, type AuthState } from "../actions";
import { Alert, Button, Field } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving..." : "Save password and continue"}
    </Button>
  );
}

export function SetPasswordForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(setPassword, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters, including a letter and a number."
        required
      />

      <Field
        label="Type it again"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />

      <SubmitButton />
    </form>
  );
}
