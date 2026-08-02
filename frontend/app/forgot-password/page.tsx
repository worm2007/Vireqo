"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { forgotPassword } from "@/lib/api";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
      setResetUrl(result.reset_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create a reset request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Reset access." subtitle="Create a secure one-time password reset link for your workspace." alternate={<Link href="/login">Return to sign in</Link>}>
      {message ? (
        <div className="auth-success-card">
          <CheckCircle2 size={28} />
          <strong>Reset request created</strong>
          <p>{message}</p>
          {resetUrl && <Link className="button button-dark full-button" href={resetUrl}>Open local reset link <ArrowRight size={17} /></Link>}
          {!resetUrl && <p className="auth-legal">Check your email for the reset link.</p>}
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label><span>Work email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark full-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Creating reset link</> : <>Continue <ArrowRight size={18} /></>}</button>
        </form>
      )}
    </AuthFrame>
  );
}
