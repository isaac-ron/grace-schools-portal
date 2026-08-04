"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui";
import {
  SubmitButton,
  ConfirmSubmit,
  TextInput,
  SelectInput,
  CheckboxInput,
  type ActionState,
} from "@/components/form";
import { createAccount, updateAccount, setAccountActive, resetPassword } from "./actions";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "parent" | "teacher" | "admin";
  can_release_results: boolean;
  is_active: boolean;
};

const ROLES = [
  { value: "parent", label: "Parent or guardian" },
  { value: "teacher", label: "Teacher" },
  { value: "admin", label: "Administration" },
];

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

export function CreateAccountForm() {
  const [state, action] = useActionState<ActionState, FormData>(createAccount, undefined);
  const [role, setRole] = useState("parent");

  return (
    <form action={action} className="flex flex-col gap-5">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Full name"
          name="full_name"
          placeholder="Mrs. Grace Achieng"
          error={err(state, "full_name")}
          required
        />
        <SelectInput
          label="Role"
          name="role"
          options={ROLES}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          error={err(state, "role")}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Email address"
          name="email"
          type="email"
          autoCapitalize="none"
          autoCorrect="off"
          hint="Used to sign in."
          error={err(state, "email")}
          required
        />
        <TextInput
          label="Phone number"
          name="phone"
          type="tel"
          placeholder="0720 970 572"
          error={err(state, "phone")}
        />
      </div>

      {role === "admin" && (
        <CheckboxInput
          label="Can release results"
          name="can_release_results"
          hint="Lets this person publish a term's results to parents. Usually only the Headteacher."
        />
      )}

      <div>
        <SubmitButton pendingLabel="Creating...">Create account</SubmitButton>
      </div>
    </form>
  );
}

export function EditAccountForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionState, FormData>(updateAccount, undefined);
  const [role, setRole] = useState(profile.role);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Feedback state={state} />
      <input type="hidden" name="id" value={profile.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Full name"
          name="full_name"
          defaultValue={profile.full_name}
          error={err(state, "full_name")}
          required
        />
        <SelectInput
          label="Role"
          name="role"
          options={ROLES}
          value={role}
          onChange={(e) => setRole(e.target.value as Profile["role"])}
          error={err(state, "role")}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Phone number"
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          error={err(state, "phone")}
        />
      </div>

      {role === "admin" && (
        <CheckboxInput
          label="Can release results"
          name="can_release_results"
          defaultChecked={profile.can_release_results}
          hint="Lets this person publish a term's results to parents."
        />
      )}

      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}

export function ActiveToggle({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionState, FormData>(setAccountActive, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={profile.id} />
      <input type="hidden" name="is_active" value={profile.is_active ? "false" : "true"} />
      {profile.is_active ? (
        <ConfirmSubmit
          confirm="Deactivate this account? They are signed out immediately and lose all access."
          pendingLabel="Deactivating..."
        >
          Deactivate account
        </ConfirmSubmit>
      ) : (
        <SubmitButton variant="secondary" pendingLabel="Reactivating...">
          Reactivate account
        </SubmitButton>
      )}
    </form>
  );
}

export function ResetPasswordForm({ profileId }: { profileId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(resetPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="id" value={profileId} />
      <div>
        <SubmitButton variant="secondary" pendingLabel="Resetting...">
          Issue a temporary password
        </SubmitButton>
      </div>
    </form>
  );
}
