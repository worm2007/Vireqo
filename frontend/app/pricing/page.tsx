import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { LaunchSection, PublicPageShell } from "@/components/PublicPageShell";

const plans = [
  {
    name: "Demo",
    price: "Free",
    badge: "Live now",
    description: "Explore Vireqo with a functional workspace and AI CRM flows.",
    features: ["Live product demo", "AI assistant preview", "Lead and task workflows", "No payment required"],
    cta: "Open demo",
    href: "/demo",
  },
  {
    name: "Starter",
    price: "Coming soon",
    badge: "Early access",
    description: "For solo founders and small teams that want one AI sales workspace.",
    features: ["AI CRM actions", "Tasks and follow-ups", "Pipeline Kanban", "Executive insights"],
    cta: "Request access",
    href: "/contact",
  },
  {
    name: "Pro",
    price: "Coming soon",
    badge: "Planned",
    description: "For teams that need integrations, roles, usage limits and advanced reporting.",
    features: ["Team workflows", "Email and calendar integrations", "Advanced automation", "Priority support"],
    cta: "Talk to us",
    href: "/contact",
  },
];

export default function PricingPage() {
  return (
    <PublicPageShell
      eyebrow="Early access pricing"
      title="Start with the live Vireqo demo. Paid plans are coming next."
      description="Vireqo is currently in early-access launch mode. The core AI CRM workspace is live, while billing and subscription plans are being prepared for public rollout."
    >
      <div className="pricing-grid">
        {plans.map((plan) => (
          <article className="pricing-card" key={plan.name}>
            <span>{plan.badge}</span>
            <h2>{plan.name}</h2>
            <strong>{plan.price}</strong>
            <p>{plan.description}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}><CheckCircle2 size={16} /> {feature}</li>
              ))}
            </ul>
            <Link href={plan.href}>{plan.cta}</Link>
          </article>
        ))}
      </div>

      <LaunchSection title="What happens during early access?">
        <p>
          Early users can test the AI CRM workspace, create leads, manage tasks, use the Command Center and explore predictive sales insights before billing is enabled.
        </p>
        <div className="launch-note"><Sparkles size={18} /> Billing, usage limits and subscriptions will be added in a later production sprint.</div>
      </LaunchSection>
    </PublicPageShell>
  );
}
