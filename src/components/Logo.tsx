export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-hidden="false">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
        style={{ background: "var(--color-primary)" }}
      >
        AL
      </span>
      <span className="text-lg font-semibold" style={{ color: "var(--color-text)" }}>
        ArcInnoLab
      </span>
    </div>
  );
}
