import { cn } from "@/lib/utils";

/** Inline error text tied to an input via aria-describedby (accessibility). */
export function FieldError({
  id,
  messages,
  className,
}: {
  id?: string;
  messages?: string[] | string;
  className?: string;
}) {
  if (!messages || (Array.isArray(messages) && messages.length === 0)) return null;
  const text = Array.isArray(messages) ? messages.join(" ") : messages;
  return (
    <p id={id} role="alert" className={cn("text-sm text-destructive-text", className)}>
      {text}
    </p>
  );
}
