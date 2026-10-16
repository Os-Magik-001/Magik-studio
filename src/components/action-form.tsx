"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button, cx } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";

type Props = {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (result: ActionResult) => void;
};

const PendingContext = createContext(false);

export function ActionForm({ action, children, className, resetOnSuccess, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Submit manually: React resets a form after an `action` prop runs, which
  // would wipe what someone typed when the server says no.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(data));
  };

  return (
    <PendingContext value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className}>
        {children}
        {state.error && (
          <p role="alert" className="mt-2 text-[13px] text-danger">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p role="status" className="mt-2 text-[13px] text-success">
            {state.message}
          </p>
        )}
      </form>
    </PendingContext>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size,
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const pending = use(PendingContext);
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      aria-busy={pending}
      className={cx(className)}
      name={name}
      value={value}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}
