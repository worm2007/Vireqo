import { LaunchSection, PublicPageShell } from "@/components/PublicPageShell";

export default function PrivacyPage() {
  return (
    <PublicPageShell
      eyebrow="Privacy policy"
      title="How Vireqo handles workspace, CRM and AI data."
      description="This early-access privacy page explains the main data categories Vireqo uses to provide the AI CRM workspace. Review with a legal professional before large-scale public launch."
      updated="8 August 2026"
    >
      <LaunchSection title="Data Vireqo stores">
        <p>Vireqo stores account, workspace, lead, conversation, appointment, task and activity data needed to run the CRM workspace and AI-assisted sales workflows.</p>
      </LaunchSection>

      <LaunchSection title="How AI is used">
        <p>AI features may use workspace context such as lead details, tasks, conversation history and pipeline state to generate summaries, draft messages, recommend next actions and perform CRM commands.</p>
      </LaunchSection>

      <LaunchSection title="Data export and deletion">
        <p>Workspace owners can access data export and workspace deletion controls from account settings. Deleting a workspace is protected by owner-only guardrails, password confirmation and a confirmation phrase.</p>
      </LaunchSection>

      <LaunchSection title="Security basics">
        <p>Vireqo uses authenticated API access, hashed passwords, token-based sessions, production CORS controls and database-backed workspace separation. Additional monitoring, billing and email infrastructure will be added as the product matures.</p>
      </LaunchSection>

      <LaunchSection title="Contact">
        <p>For privacy questions, contact Vireqo through the contact page or the official Vireqo communication channel you use for early access.</p>
      </LaunchSection>
    </PublicPageShell>
  );
}
