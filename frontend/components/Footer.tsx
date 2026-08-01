import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div><BrandMark /><p>Intelligent lead infrastructure for businesses that care about every opportunity.</p></div>
        <div><strong>Product</strong><Link href="/demo">Live demo</Link><Link href="/dashboard">Dashboard</Link><a href="#system">System</a></div>
        <div><strong>Company</strong><a href="mailto:hello@vireqo.example">Contact</a><span>Privacy</span><span>Terms</span></div>
        <div className="footer-status"><span><i /> Systems operational</span><small>© 2026 Vireqo. Working brand.</small></div>
      </div>
    </footer>
  );
}
