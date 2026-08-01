import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Vireqo home">
      <span className="brand-symbol" aria-hidden="true">
        <span />
        <span />
      </span>
      {!compact && <span className="brand-word">Vireqo</span>}
    </Link>
  );
}
