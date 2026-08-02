"use client";

import { AuthFrame } from "@/components/AuthFrame";
import { register } from "@/lib/api";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    business_name: "",
    industry: "Professional Services",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setError("Password must contain at least one letter and one number");
      setLoading(false);
      return;
    }
    try {
      await register(form);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
      setLoading(false);
    }
  }

  return (
    <AuthFrame
      title="Create your system."
      subtitle="Launch a protected lead workspace and connect your first acquisition channel."
      alternate={<>Already have a workspace? <Link href="/login">Sign in</Link></>}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="field-row">
          <label><span>Your name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your full name" /></label>
          <label><span>Business name</span><input required value={form.business_name} onChange={(event) => setForm({ ...form, business_name: event.target.value })} placeholder="Company or brand" /></label>
        </div>
        <label><span>Work email</span><input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@company.com" /></label>
        <label>
          <span>Industry</span>
          <select value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}>
            <option>Professional Services</option><option>Real Estate</option><option>Clinics & Healthcare</option><option>Marketing Agency</option><option>Fitness & Wellness</option><option>Home Services</option>
          </select>
        </label>
        <label><span>Password</span><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="8+ characters, including a letter and number" /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-dark full-button" disabled={loading}>
          {loading ? <><LoaderCircle className="spin" size={18} /> Creating workspace</> : <>Create Vireqo workspace <ArrowRight size={18} /></>}
        </button>
        <p className="auth-legal">By continuing, you agree to the working demo terms and privacy notice.</p>
      </form>
    </AuthFrame>
  );
}
