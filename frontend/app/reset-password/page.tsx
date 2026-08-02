"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { resetPassword } from "@/lib/api";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) return setError("Reset token is missing");
    if (password !== confirm) return setError("Passwords do not match");
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Password must contain at least one letter and one number");
    setLoading(true);
    try {
      await resetPassword(token, password);
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password." subtitle="The reset link is single-use and expires automatically." alternate={<Link href="/login">Return to sign in</Link>}>
      {complete ? (
        <div className="auth-success-card"><CheckCircle2 size={28} /><strong>Password updated</strong><p>Your previous sessions were revoked. Sign in with the new password.</p><Link className="button button-dark full-button" href="/login">Sign in <ArrowRight size={17} /></Link></div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label><span>New password</span><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8+ characters, including a letter and number" /></label>
          <label><span>Confirm password</span><input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Repeat the new password" /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-dark full-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Updating password</> : <>Update password <ArrowRight size={18} /></>}</button>
        </form>
      )}
    </AuthFrame>
  );
}
