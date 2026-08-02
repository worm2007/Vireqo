import Link from "next/link";
import { BrandMark } from "./BrandMark";

export function Footer() {
  return <footer className="v3-footer"><div className="shell v3-footer-grid"><div><BrandMark/><p>AI sales infrastructure for modern businesses.</p></div><div><strong>Product</strong><a href="#product">Overview</a><a href="#journey">How it works</a><Link href="/demo">Live demo</Link></div><div><strong>Industries</strong><a href="#industries">Clinic</a><a href="#industries">Real estate</a><a href="#industries">Agencies</a></div><div><strong>Company</strong><a href="mailto:hello@vireqo.example">Contact</a><span>Privacy</span><span>Terms</span></div></div><div className="shell v3-footer-bottom"><span>© 2026 Vireqo. Working brand.</span><span><i/> AI is always working for you</span></div></footer>;
}
