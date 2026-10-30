"use client";
import { useActionState } from "react";
import { INITIAL_STATE, type ActionState } from "@/lib/models";
import { Feedback } from "./forms";
import { Button } from "./ui/button";

export function MutationForm({
  action,
  children,
  label,
  disabled = false,
  className = "",
  pendingLabel = "Menyimpan…",
  revision,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
  pendingLabel?: string;
  revision?: number;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  return (
    <form action={formAction} className={`space-y-4 ${className}`}>
      <Feedback state={state} />
      <fieldset
        key={revision}
        disabled={disabled || pending}
        className="space-y-4 disabled:opacity-60"
      >
        {children}
        <Button type="submit" disabled={disabled || pending}>
          {pending ? pendingLabel : label}
        </Button>
      </fieldset>
    </form>
  );
}
