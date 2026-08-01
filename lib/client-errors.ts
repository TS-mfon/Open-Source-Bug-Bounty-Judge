type ValidationIssue = {
  path?: PropertyKey[];
  message?: string;
};

type ErrorEnvelope = {
  error?: {
    message?: string;
    details?: ValidationIssue[];
  };
};

export function validationMessage(issues: ValidationIssue[], fallback: string) {
  const issue = issues[0];
  if (!issue) return fallback;
  const field = issue.path?.length
    ? issue.path.map((part) => String(part)).join(".")
    : "";
  const message = issue.message?.trim() || fallback;
  return field ? `${field}: ${message}` : message;
}

export function apiErrorMessage(body: unknown, fallback: string) {
  const envelope = body as ErrorEnvelope;
  const message = envelope?.error?.message?.trim() || fallback;
  const details = Array.isArray(envelope?.error?.details)
    ? envelope.error.details
    : [];
  return details.length ? validationMessage(details, message) : message;
}
