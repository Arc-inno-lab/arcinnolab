export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-arcinnolab.svg"
        alt="ArcInnoLab"
        className={compact ? "h-7 w-auto" : "h-9 w-auto"}
      />
    </span>
  );
}
