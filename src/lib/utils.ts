import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize an email for storage and comparison: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
