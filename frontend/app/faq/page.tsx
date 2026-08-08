import { LaunchSection, PublicPageShell } from "@/components/PublicPageShell";

const faqs = [
  ["What is Vireqo?", "Vireqo is an AI-powered CRM workspace for managing leads, conversations, tasks, follow-ups and sales pipeline activity from one dashboard."],
  ["Who is Vireqo for?", "It is designed for founders, agencies, consultants, clinics, real estate teams and service businesses that need faster lead follow-up."],
  ["Is Vireqo live?", "Yes. The product is deployed with a live backend, PostgreSQL database and working frontend. Some production systems, such as billing and email delivery, are still being finalized."],
  ["Does Vireqo use AI?", "Yes. Vireqo uses AI for CRM actions, pipeline summaries, draft generation, executive insights, lead scoring and workflow recommendations."],
  ["Can I delete my data?", "Yes. Vireqo includes workspace export and owner-only workspace deletion controls inside account settings."],
  ["Is billing active?", "Not yet. Pricing is shown as early access while subscription billing is prepared in a later sprint."],
  ["Can I connect Gmail, Calendar or WhatsApp?", "Those integrations are planned for later production sprints. The current live version focuses on the AI CRM core."],
];

export default function FAQPage() {
  return (
    <PublicPageShell
      eyebrow="Frequently asked questions"
      title="Everything early users should know before trying Vireqo."
      description="A simple overview of what Vireqo does today, what is live, and what is planned next."
    >
      <div className="faq-list">
        {faqs.map(([question, answer]) => (
          <LaunchSection title={question} key={question}>
            <p>{answer}</p>
          </LaunchSection>
        ))}
      </div>
    </PublicPageShell>
  );
}
