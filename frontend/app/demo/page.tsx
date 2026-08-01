import { BrandMark } from "@/components/BrandMark";
import { ChatWidget } from "@/components/ChatWidget";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

export default function DemoPage() {
  return (
    <main className="demo-page">
      <header className="demo-nav shell"><BrandMark /><Link href="/"><ArrowLeft size={16} /> Back to website</Link></header>
      <div className="shell demo-layout">
        <section className="demo-copy">
          <span className="section-kicker light"><Sparkles size={14} /> Functional product demo</span>
          <h1>Have a real conversation with your future acquisition system.</h1>
          <p>Add your email above the chat, then ask about pricing, a demo, urgency or implementation. The backend will create and score a real CRM opportunity.</p>
          <div className="demo-checks"><span><CheckCircle2 size={18} /> Persistent conversation</span><span><CheckCircle2 size={18} /> Contact extraction</span><span><CheckCircle2 size={18} /> Intent scoring</span><span><CheckCircle2 size={18} /> CRM visibility</span></div>
          <Link className="button" href="/dashboard">Watch it reach the dashboard <ArrowUpRight size={18} /></Link>
        </section>
        <div className="demo-chat-frame"><div className="demo-frame-label"><span>Live website module</span><i>v0.1</i></div><ChatWidget embedded /></div>
      </div>
    </main>
  );
}
