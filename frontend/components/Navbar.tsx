"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "./BrandMark";

const links = [
  ["Product", "#product"],
  ["How it works", "#journey"],
  ["Industries", "#industries"],
  ["Results", "#results"],
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        className={`v3-nav-wrap ${scrolled ? "is-scrolled" : ""}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="v3-nav shell">
          <BrandMark />
          <nav className="v3-nav-links" aria-label="Primary navigation">
            {links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="v3-nav-actions">
            <Link href="/login" className="v3-signin">Sign in</Link>
            <Link href="/demo" className="v3-nav-cta">Book demo <ArrowUpRight size={16} /></Link>
            <button className="v3-menu-button" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>
      <AnimatePresence>
        {open && (
          <motion.div className="v3-mobile-menu" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
            <Link href="/login">Sign in</Link>
            <Link href="/demo" className="v3-mobile-cta">Book demo <ArrowUpRight size={16} /></Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
