<div align="center">

  <img src="frontend/public/etherx-logo.png" alt="EtherX Meet Logo" width="160" height="160" style="border-radius: 24px; margin-bottom: 16px;" />

  # EtherX Meet
  ### *The Next-Generation Decentralized Video Conferencing & Virtual Workspace*

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
  [![WebRTC](https://img.shields.io/badge/WebRTC-Real--Time-333333?style=for-the-badge&logo=webrtc&logoColor=white)](https://webrtc.org/)
  [![Polygon](https://img.shields.io/badge/Polygon-Amoy-8247E5?style=for-the-badge&logo=polygon&logoColor=white)](https://polygon.technology/)
  [![Web3Auth](https://img.shields.io/badge/Web3Auth-Sapphire-0364FF?style=for-the-badge&logo=web3dotjs&logoColor=white)](https://web3auth.io/)

  <p align="center">
    <strong>Ultra-low latency audio/video • Decentralized Web3 & Web2 Auth • Collaborative Whiteboard • Smart Scheduling</strong>
  </p>

  <p align="center">
    <a href="#overview">Overview</a> •
    <a href="#key-features">Key Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#project-structure">Project Structure</a> •
    <a href="#security--privacy">Security & Privacy</a>
  </p>

</div>

---

## Overview

**EtherX Meet** is a high-performance, privacy-focused video conferencing platform designed to bridge Web2 convenience with Web3 security. Engineered from the ground up for minimal latency, sleek dark luxury aesthetics, and multi-device fluidity, EtherX Meet offers an enterprise-grade meeting experience without surveillance or data exploitation.

Whether hosting an all-hands call, a Web3 governance summit, or an interactive whiteboard brainstorming session, EtherX Meet provides seamless communication, decentralized storage for recordings, and smart calendar integration.

---

## Key Features

### High-Fidelity Video & Audio
- **WebRTC Mesh & LiveKit Core**: Crystal-clear, ultra-low latency audio/video streaming.
- **Adaptive Layouts**: Automatic speaker spotlight, active speaker detection, grid and focus views.
- **Smart Mobile Adaptation**: Fullscreen landscape viewing on phones for shared screens and presentations.
- **Noise Suppression**: Deep filter audio toggle for eliminating ambient noise.
- **Virtual Backgrounds**: Fluid background blurring and preset selection previewed directly from the pre-join lobby.

### Dual Web3 & Web2 Authentication
- **MetaMask / Web3Auth Embedded Wallets**: Sign in seamlessly with social accounts backed by non-custodial Polygon wallets.
- **Google OAuth 2.0 & Password Auth**: Enterprise-grade Google Sign-In with automated email-linking protection to prevent account takeover.
- **Zero-Friction Guest Mode**: One-click instant lobby join with host admittance approval.

### Real-Time Collaborative Whiteboard
- **Multi-User Canvas**: Live synchronized drawing with host-controlled permissions.
- **Asset Attachment**: Drag-and-drop image uploads viewable by all meeting participants.
- **Vector & PDF Export**: Instant export to PNG or vector-optimized high-definition PDF.

### Smart Meeting Management
- **Instant & Scheduled Rooms**: Schedule meetings with recurring cadence and automatic duration checks.
- **Calendar & Invitations**: Direct integration with Google Calendar and automated email invitations powered by EmailJS.
- **Web Push Notifications**: Real-time push alerts for join requests and upcoming meeting reminders.

### Decentralized Storage & Recording
- **Serverless & Cloud Recording**: Client-side recording with instant download upon meeting end.
- **IPFS & Cloudflare R2**: Secure, encrypted meeting archive storage through Pinata IPFS and signed S3-compatible URLs.
- **Restricted Access**: Time-expiring signed playback URLs to protect private deliberations.

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons |
| **Video & Signaling** | WebRTC, Socket.IO, LiveKit Client SDK, 100ms Live SDK |
| **Backend API** | Node.js, Express, Passport.js, Helmet, Morgan |
| **Databases** | Supabase Postgres (with embedded in-memory `@electric-sql/pglite` dev fallback), MongoDB Atlas |
| **Web3 & Blockchain** | Ethers.js, Web3Auth Modal, Polygon Network |
| **Notifications & Mail** | EmailJS, Web Push (VAPID) |
| **Decentralized Storage** | Pinata IPFS, Cloudflare R2 |

---

## Getting Started

### Prerequisites
- **Node.js**: `v20+` or `v24+`
- **npm** or **yarn** / **pnpm**
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/kishore1035/etherxsuitemaster.git
cd etherxsuitemaster
```

### 2. Configure Environment Variables
Copy and configure the environment variables for both backend and frontend:

#### Backend Configuration (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
DATABASE_URL=
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_INVITE_TEMPLATE_ID=your_emailjs_invite_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
EMAILJS_PRIVATE_KEY=your_emailjs_private_key
LIVEKIT_API_KEY=your_livekit_key
LIVEKIT_API_SECRET=your_livekit_secret
LIVEKIT_WS_URL=wss://...
WEB3AUTH_CLIENT_ID=your_web3auth_client_id
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=https://...
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0x...
```

#### Frontend Configuration (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_CONTRACT_ADDRESS=0x...
VITE_POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
VITE_NETWORK=testnet
VITE_PINATA_JWT=your_pinata_jwt
VITE_PINATA_GATEWAY=https://...
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id
VITE_LIVEKIT_WS_URL=wss://...
```

---

### 3. Run Locally

#### Start Backend Server:
```bash
cd backend
npm install
npm run dev
```
*Backend starts on `http://localhost:5000`*

#### Start Frontend Client:
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend will launch on `http://localhost:3000`*

---

## Project Structure

```text
etherxsuitemaster/
├── backend/                    # Express Signaling & REST API
│   ├── src/
│   │   ├── config/             # DB (Postgres/PGlite), Passport, Origins
│   │   ├── middleware/         # Auth, validation, error handlers
│   │   ├── models/             # Database queries and models
│   │   ├── routes/             # Auth, Rooms, Recordings, Feedback, Agendas
│   │   ├── signaling/          # Socket.IO WebRTC signaling & room management
│   │   └── index.js            # Server entrypoint
│   └── package.json
├── frontend/                   # React + Vite Frontend
│   ├── public/                 # Static assets, icons, service worker, manifest
│   ├── src/
│   │   ├── assets/             # Brand logos and multimedia
│   │   ├── components/         # Reusable UI, modals, whiteboard, video tiles
│   │   ├── contexts/           # Auth, Meeting, and Theme providers
│   │   ├── hooks/              # useWebRTC, useMeeting, useSocket, useAuth
│   │   ├── pages/              # Landing, Room, Dashboard, Recordings, Settings
│   │   └── App.jsx             # Main Router and layout
│   └── package.json
├── .gitignore                  # Git ignore rules
└── README.md                   # Project documentation
```

---

## Security & Privacy

- **End-to-End Media**: Peer-to-peer WebRTC connections with DTLS/SRTP encryption.
- **Robust Authentication**: Non-custodial Web3 cryptographic keypairs alongside OAuth 2.0 with strict origin validation.
- **Protected Recordings**: Cloud storage tokens expire within 1 hour; public access is disabled by default.
- **Safe Database Layer**: Parameterized SQL queries and zero plain-text credential persistence.

---

## Contributors & Acknowledgements

Created with passion by the **IgniteX** team. Built for communities, developers, and organizations looking for sovereign, high-performance collaboration tools.

---

<div align="center">
  <sub>EtherX Meet © 2026. Empowering Decentralized Conversations.</sub>
</div>
