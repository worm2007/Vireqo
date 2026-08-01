import { BrandMark } from "./BrandMark";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

export function AuthFrame({ title, subtitle, children, alternate }: { title: string; subtitle: string; children: ReactNode; alternate: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-top"><BrandMark /><Link href="/">Back to website</Link></div>
        <div className="auth-brand-content">
          <span className="section-kicker light"><Sparkles size={14} /> Lead intelligence, unified</span>
          <h2>Build a pipeline that never forgets a conversation.</h2>
          <p>Capture every enquiry, understand its intent and give your team a clear next action.</p>
          <div className="auth-benefits"><span><Check size={16} /> Live AI concierge</span><span><Check size={16} /> Structured opportunity CRM</span><span><Check size={16} /> Intent scoring and routing</span></div>
        </div>
        <div className="auth-quote"><p>“Premium acquisition infrastructure for teams that care about response time.”</p><span>Vireqo product principle</span></div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-card"><div className="auth-heading"><span>Vireqo workspace</span><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-alternate">{alternate}</div></div>
      </section>
    </main>
  );
}
