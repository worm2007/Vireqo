#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/frontend"
[ -f .env.local ] || cp .env.example .env.local
npm install
npm run dev
