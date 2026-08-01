"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav-wrap ${scrolled ? "is-scrolled" : ""}`}>
      <nav className="nav shell" aria-label="Main navigation">
        <BrandMark />
        <div className={`nav-links ${open ? "is-open" : ""}`}>
          <a href="#system" onClick={() => setOpen(false)}>System</a>
          <a href="#experience" onClick={() => setOpen(false)}>Experience</a>
          <a href="#results" onClick={() => setOpen(false)}>Results</a>
          <Link href="/demo" onClick={() => setOpen(false)}>Live demo</Link>
        </div>
        <div className="nav-actions">
          <Link className="text-link hide-mobile" href="/login">Sign in</Link>
          <Link className="button button-small nav-cta" href="/demo">Try Vireqo</Link>
          <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>
    </header>
  );
}
