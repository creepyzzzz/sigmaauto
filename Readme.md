# Keyo 🔑 — Instant Link Bypass & Key Extractor

A modern, high-speed Progressive Web App (PWA) and automated resolver designed to bypass link shortener countdowns, decrypt verification sessions, and extract access keys instantly.

---

## Features

- **Apple-Grade Liquid Glass UI**: SF Pro Rounded & Display typography, dynamic viewport responsiveness, fluid spring physics, and minimal Apple aesthetic.
- **PWA Ready**: Installable directly on iOS (Safari) and Android (Chrome) as a native standalone application.
- **Real-Time Stream Engine**: Server-Sent Events (SSE) providing live countdowns and bypass progress logs.
- **Automated Bypass Resolvers**:
  - **Lksfy**: Double Base64 + AES-256-CBC session decrypt & PKCS#7 unpadding.
  - **Nanolinks**: Cookie session & rapid redirect traversal.
  - **Arolinks / Adrinolinks**: Intermediate token injection & referrer verification.
  - **Telegram**: Start code & verification parameter decoding.
- **1-Click Cloud Auto-Generation**: Instant access token synthesis without requiring a manual link.

---

## Getting Started

### Prerequisites
- Node.js 18+ (Node.js 20 or 22 recommended)
- npm, pnpm, or yarn

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment (Vercel)

1. Push your repository to GitHub / GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. Set `NEXT_PUBLIC_SITE_URL` to your domain (e.g. `https://thisiskeyo.vercel.app`).
4. Deploy! Next.js serverless functions will automatically handle the backend extraction routes.

---

## Standalone Python Script (CLI / Termux)

The original CLI tool is located in the [`scripts/`](file:///d:/WORK/sigmaauto/scripts) folder:

```bash
# Install python dependencies
pip install -r scripts/requirements.txt

# Extract key from a direct URL
python scripts/sigmastudy.py --direct-url "https://lksfy.com/iZ3za"

# Run default automatic discovery
python scripts/sigmastudy.py --default-flow
```
