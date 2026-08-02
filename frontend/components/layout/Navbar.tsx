"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "../BrandMark";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Industries", href: "#industries" },
  { label: "How it works", href: "#journey" },
  { label: "Results", href: "#results" },
];

export function NavbarV3() {
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <>
      <motion.header
        className={`navbar-v3-wrap ${scrolled ? "is-scrolled" : ""}`}
        initial={reduceMotion ? false : { opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.7,
          ease: [0.2, 0.8, 0.2, 1],
        }}
      >
        <div className="navbar-v3">
          <Link
            href="/"
            className="navbar-v3-brand"
            aria-label="Vireqo homepage"
          >
            <BrandMark />
          </Link>

          <nav className="navbar-v3-links" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="navbar-v3-link">
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="navbar-v3-actions">
            <Link href="/login" className="navbar-v3-signin">
              Sign in
            </Link>

            <Link href="/demo" className="navbar-v3-cta">
              <span>Book demo</span>
              <ArrowUpRight size={16} />
            </Link>

            <button
              type="button"
              className="navbar-v3-menu"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((current) => !current)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="navbar-v3-mobile"
            initial={reduceMotion ? false : { opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <nav aria-label="Mobile navigation">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="navbar-v3-mobile-actions">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                Sign in
              </Link>

              <Link
                href="/demo"
                className="navbar-v3-mobile-cta"
                onClick={() => setMobileOpen(false)}
              >
                Book demo
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}