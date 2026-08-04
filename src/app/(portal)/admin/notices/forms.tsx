"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui";
import {
  SubmitButton,
  TextInput,
  TextArea,
  SelectInput,
  CheckboxInput,
  type ActionState,
} from "@/components/form";
import { createNotice, setNoticePublished } from "./actions";

type Opt = { value: string; label: string };

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.ok) return <Alert tone="success">{state.ok}</Alert>;
  return null;
}

const err = (s: ActionState, f: string) => s?.fieldErrors?.[f]?.[0];

export function NoticeForm({ classes }: { classes: Opt[] }) {
  const [state, action] = useActionState<ActionState, FormData>(createNotice, undefined);
  const [audience, setAudience] = useState("all_parents");

  return (
    <form action={action} className="flex flex-col gap-5">
      <Feedback state={state} />

      <TextInput
        label="Title"
        name="title"
        placeholder="Term 2 closing date"
        error={err(state, "title")}
        required
      />

      <TextArea
        label="Notice"
        name="body"
        placeholder="Term 2 closes on Friday 7 August. Buses leave the school at 10:00am."
        hint="Keep it short. Most parents read this on a phone."
        error={err(state, "body")}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput
          label="Who sees it"
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          options={[
            { value: "all_parents", label: "All parents" },
            { value: "single_class", label: "One class" },
            { value: "all_staff", label: "All staff" },
          ]}
          error={err(state, "audience")}
          required
        />
        {audience === "single_class" && (
          <SelectInput
            label="Class"
            name="class_id"
            options={classes}
            placeholder={classes.length ? "Choose" : "No classes for the current year"}
            error={err(state, "class_id")}
            required
          />
        )}
      </div>

      <CheckboxInput
        label="Publish immediately"
        name="publish_now"
        defaultChecked
        hint="Leave unticked to save a draft nobody can see yet."
      />

      <div>
        <SubmitButton pendingLabel="Saving...">Save notice</SubmitButton>
      </div>
    </form>
  );
}

export function PublishToggle({
  noticeId,
  isPublished,
}: {
  noticeId: string;
  isPublished: boolean;
}) {
  const [, action] = useActionState<ActionState, FormData>(setNoticePublished, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={noticeId} />
      <input type="hidden" name="publish" value={isPublished ? "false" : "true"} />
      <SubmitButton variant="secondary" pendingLabel="Working...">
        {isPublished ? "Withdraw" : "Publish"}
      </SubmitButton>
    </form>
  );
}
