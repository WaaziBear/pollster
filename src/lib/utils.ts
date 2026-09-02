import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize an email for storage and comparison: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Derive a human-readable display name from an email: the local-part before
 * '@'. Falls back to the full email if there is no local-part. Used for
 * comment attribution (User.name is intentionally ignored).
 */
export function displayNameFromEmail(email: string): string {
  return email.split("@")[0] || email;
}
