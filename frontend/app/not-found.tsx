import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <main className="marketing-page v3-page launch-page not-found-page">
      <section className="not-found-card">
        <BrandMark />
        <span><Sparkles size={15} /> Page not found</span>
        <h1>This Vireqo page is not available.</h1>
        <p>The page may have moved, or the route is not part of the public launch yet.</p>
        <div>
          <Link href="/"><ArrowLeft size={17} /> Back to homepage</Link>
          <Link href="/demo">Open demo</Link>
        </div>
      </section>
    </main>
  );
}
