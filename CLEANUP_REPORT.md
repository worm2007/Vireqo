# Vireqo Clean Stable

This package restores the last known stable working version from the `main` branch.

Removed from the mixed working copy:
- unfinished V3 navbar migration
- deleted/broken Navbar import state
- duplicate experimental hero components
- large duplicated CSS blocks from unfinished components
- temporary empty architecture folders and macOS metadata

Kept:
- working premium Sprint 1 homepage
- existing landing page sections and animation
- login, signup, demo and dashboard pages
- FastAPI backend, authentication, leads, chatbot, appointments and analytics
- TypeScript 6.0.2 compatibility fix

Use this as the new stable base. Future upgrades should be added one complete feature at a time on a feature branch.
