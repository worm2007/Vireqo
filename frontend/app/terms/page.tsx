import { LaunchSection, PublicPageShell } from "@/components/PublicPageShell";

export default function TermsPage() {
  return (
    <PublicPageShell
      eyebrow="Terms of use"
      title="Rules for using the Vireqo early-access product."
      description="These starter terms describe acceptable use of the live Vireqo AI CRM workspace. Review with a legal professional before large-scale public launch."
      updated="8 August 2026"
    >
      <LaunchSection title="Early-access product">
        <p>Vireqo is currently an early-access AI CRM product. Features may change, improve or be removed as the product is tested and prepared for broader public launch.</p>
      </LaunchSection>

      <LaunchSection title="Account responsibility">
        <p>You are responsible for keeping your login credentials secure and for the lead, customer, task and business data you add to your workspace.</p>
      </LaunchSection>

      <LaunchSection title="Acceptable use">
        <p>Do not use Vireqo for spam, illegal activity, harassment, scraping, unauthorized data collection, harmful automation or attempts to disrupt the service.</p>
      </LaunchSection>

      <LaunchSection title="AI output disclaimer">
        <p>AI outputs may be incomplete, inaccurate or require review. Users should verify important business, legal, financial or customer-facing messages before relying on them.</p>
      </LaunchSection>

      <LaunchSection title="Limitations">
        <p>Vireqo is provided during early access without guarantees of uninterrupted availability. Production monitoring, billing, integrations and support systems will continue to improve over time.</p>
      </LaunchSection>
    </PublicPageShell>
  );
}
