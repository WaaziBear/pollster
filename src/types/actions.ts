export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data };
}
