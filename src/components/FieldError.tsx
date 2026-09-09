export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-sm font-medium" style={{ color: "var(--color-danger)" }}>
      {message}
    </p>
  );
}
