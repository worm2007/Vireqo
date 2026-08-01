"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { register } from "@/lib/api";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", business_name: "", industry: "Professional Services" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    try { await register(form); router.push("/dashboard"); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to create workspace"); setLoading(false); }
  }

  return (
    <AuthFrame title="Create your system." subtitle="Launch a polished lead workspace and connect the first acquisition channel." alternate={<>Already have a workspace? <Link href="/login">Sign in</Link></>}>
      <form className="auth-form" onSubmit={submit}>
        <div className="field-row"><label><span>Your name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></label><label><span>Business name</span><input required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Company or brand" /></label></div>
        <label><span>Work email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" /></label>
        <label><span>Industry</span><select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}><option>Professional Services</option><option>Real Estate</option><option>Clinics & Healthcare</option><option>Marketing Agency</option><option>Fitness & Wellness</option><option>Home Services</option></select></label>
        <label><span>Password</span><input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark full-button" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Creating workspace</> : <>Create Vireqo workspace <ArrowRight size={18} /></>}</button>
        <p className="auth-legal">By continuing, you agree to the working demo terms and privacy notice.</p>
      </form>
    </AuthFrame>
  );
}
