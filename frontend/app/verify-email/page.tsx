"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { resendVerification, verifyEmail } from "@/lib/api";
import { ArrowRight, CheckCircle2, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const queryToken = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(queryToken);
    if (!queryToken) {
      setLoading(false);
      return;
    }

    verifyEmail(queryToken)
      .then((result) => {
        setMessage(result.message);
        setComplete(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to verify email"))
      .finally(() => setLoading(false));
  }, []);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setResending(true);
    setError("");
    setMessage("");
    setVerificationUrl(null);
    try {
      const result = await resendVerification(email);
      setMessage(result.message);
      setVerificationUrl(result.verification_url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create verification link");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthFrame
      title="Verify your email."
      subtitle="Confirm your email address to protect your workspace, reset access safely and receive security notices."
      alternate={<Link href="/login">Return to sign in</Link>}
    >
      {loading ? (
        <div className="auth-success-card auth-verification-card">
          <LoaderCircle className="spin" size={28} />
          <strong>Checking verification link</strong>
          <p>Please wait while Vireqo validates this one-time token.</p>
        </div>
      ) : complete ? (
        <div className="auth-success-card auth-verification-card">
          <ShieldCheck size={30} />
          <strong>Email verified</strong>
          <p>{message || "Your email address is now verified."}</p>
          <Link className="button button-dark full-button" href="/dashboard">
            Open dashboard <ArrowRight size={17} />
          </Link>
        </div>
      ) : token && error ? (
        <div className="auth-success-card auth-verification-card">
          <MailCheck size={30} />
          <strong>Verification link unavailable</strong>
          <p>{error}</p>
          <p className="auth-legal">Request a fresh link below.</p>
        </div>
      ) : null}

      {!complete && (
        <form className="auth-form auth-resend-form" onSubmit={resend}>
          <label>
            <span>Work email</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          </label>
          {message && <div className="auth-inline-success"><CheckCircle2 size={16} /> {message}</div>}
          {verificationUrl && <Link className="button button-dark full-button" href={verificationUrl}>Open local verification link <ArrowRight size={17} /></Link>}
          {error && !token && <p className="form-error">{error}</p>}
          <button className="demo-login-button" type="submit" disabled={resending}>
            {resending ? "Creating link..." : "Resend verification link"}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
