"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { demoLogin, login } from "@/lib/api";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { await login(form.email, form.password); router.push("/dashboard"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in"); setLoading(false); }
  }

  async function enterDemo() {
    setLoading(true); setError("");
    try { await demoLogin(); router.push("/dashboard"); }
    catch (err) { setError(err instanceof Error ? err.message : "Demo API unavailable"); setLoading(false); }
  }

  return (
    <AuthFrame title="Welcome back." subtitle="Enter your workspace and act on the opportunities that matter." alternate={<>New to Vireqo? <Link href="/signup">Create an account</Link></>}>
      <form className="auth-form" onSubmit={submit}>
        <label><span>Work email</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" /></label>
        <label><div className="label-row"><span>Password</span><button type="button">Forgot password?</button></div><input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••••••" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark full-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Opening workspace</> : <>Sign in <ArrowRight size={18} /></>}</button>
        <div className="auth-divider"><span>or</span></div>
        <button className="demo-login-button" type="button" onClick={enterDemo}>Enter the live demo workspace</button>
      </form>
    </AuthFrame>
  );
}
