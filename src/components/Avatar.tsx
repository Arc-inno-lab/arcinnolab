function initials(nom?: string | null, prenom?: string | null) {
  const a = (prenom || "").trim().charAt(0);
  const b = (nom || "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

export function Avatar({
  nom,
  prenom,
  photoUrl,
  size = "md",
}: {
  nom?: string | null;
  prenom?: string | null;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const className = `avatar avatar-${size}`;
  if (photoUrl) {
    return (
      <span className={className}>
        <img src={photoUrl} alt="" />
      </span>
    );
  }
  return (
    <span className={className} aria-hidden="true">
      {initials(nom, prenom)}
    </span>
  );
}
