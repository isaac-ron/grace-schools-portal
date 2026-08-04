"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type AuthState } from "../actions";
import { Alert, Button, Field } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthState, FormData>(signIn, undefined);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-5">
      {next && <input type="hidden" name="next" value={next} />}

      {state?.error && <Alert tone="error">{state.error}</Alert>}

      <Field
        label="Email or phone number"
        name="email"
        type="text"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        required
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <SubmitButton />
    </form>
  );
}
