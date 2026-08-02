"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { demoLogin, hasSession, login } from "@/lib/api";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasSession()) router.replace("/dashboard");
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form.email, form.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setLoading(false);
    }
  }

  async function enterDemo() {
    setLoading(true);
    setError("");
    try {
      await demoLogin();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo API unavailable");
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      title="Welcome back."
      subtitle="Enter your workspace and act on the opportunities that matter."
      alternate={<>New to Vireqo? <Link href="/signup">Create an account</Link></>}
    >
      <form className="auth-form" onSubmit={submit}>
        <label>
          <span>Work email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@company.com"
          />
        </label>
        <label>
          <div className="label-row">
            <span>Password</span>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="••••••••••••"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={18} /> Opening workspace</> : <>Sign in <ArrowRight size={18} /></>}
        </button>
        <div className="auth-divider"><span>or</span></div>
        <button className="demo-login-button" type="button" onClick={enterDemo} disabled={loading}>
          Enter the live demo workspace
        </button>
      </form>
    </AuthFrame>
  );
}
