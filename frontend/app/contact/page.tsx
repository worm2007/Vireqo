import Link from "next/link";
import { ArrowUpRight, Mail, MessageSquareText, Sparkles } from "lucide-react";
import { LaunchSection, PublicPageShell } from "@/components/PublicPageShell";

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Contact Vireqo"
      title="For demos, early access, partnerships and product feedback."
      description="Vireqo is in early production rollout. Reach out to discuss the product, request access, or share feedback from your business workflow."
    >
      <div className="contact-grid">
        <LaunchSection title="Get in touch">
          <p>Use this page as the public contact point while email delivery and in-app contact automation are being finalized.</p>
          <div className="contact-actions">
            <a href="mailto:hello@vireqo.in"><Mail size={17} /> Email Vireqo</a>
            <Link href="/demo"><Sparkles size={17} /> Try the demo</Link>
          </div>
        </LaunchSection>
        <LaunchSection title="Best for">
          <ul className="launch-list">
            <li><MessageSquareText size={16} /> Demo requests</li>
            <li><MessageSquareText size={16} /> Early access discussions</li>
            <li><MessageSquareText size={16} /> Product feedback</li>
            <li><MessageSquareText size={16} /> Business partnership ideas</li>
          </ul>
        </LaunchSection>
      </div>

      <section className="launch-cta-card">
        <div>
          <span>Functional product demo</span>
          <h2>See how Vireqo captures, qualifies and organizes leads.</h2>
        </div>
        <Link href="/demo">Open demo <ArrowUpRight size={17} /></Link>
      </section>
    </PublicPageShell>
  );
}
