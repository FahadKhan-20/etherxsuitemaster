# EtherXMeet (NxtMeet) — Web3 Video Conferencing Platform

> **Lead Architect & Original Author:** [Vinay G K (@vinay3254)](https://github.com/vinay3254)  
> **Initial Project Launch:** May 2026  
> **License:** Proprietary & Confidential — Copyright (c) 2026 Vinay G K. All rights reserved.

---

## Overview

**EtherXMeet** (also developed and referenced as **NxtMeet**) is a next-generation decentralized video conferencing suite engineered with peer-to-peer WebRTC mesh infrastructure, Polygon smart contract verification, and gasless embedded onboarding.

It bridges Web3 trustless authenticity with the fluid, low-latency collaboration features of modern enterprise video platforms.

---

## Core Architecture & Engineering Deliverables

### 1. Smart Contracts & Web3 Verification
* **MeetingRegistry.sol (Polygon)**: Decentralized meeting lifecycle management. Handles `createMeeting()` with IPFS content hashing, verifiable on-chain attendance through `joinMeeting()`, and immutable end-of-meeting summary seals via Keccak256 notes hashing.
* **MeetingNFT.sol (ERC-721)**: Verifiable Proof-of-Attendance (POAP) meeting receipt minter issuing cryptographic attendee certificates linked to IPFS metadata.
* **Embedded Gasless Wallet (WalletContext)**: Client-side Ethers.js wallet onboarding with operator gas faucets, allowing seamless guest entry without requiring manual MetaMask setup.

### 2. Real-Time Video & Mesh Engine
* **Custom WebRTC Mesh Engine (useWebRTC.js)**: Robust P2P connection manager handling SDP offer/answer exchanges, trickle ICE candidate buffering, and adaptive bitrate media tracks.
* **In-Room Command Center (VideoRoom.jsx)**: Active speaker spotlighting, client-side screen recording via MediaRecorder API, grid/filmstrip layouts, and docking toolbars.
* **Live Speech Transcription (LiveTranscript.jsx)**: Real-time client-side speech-to-text via Web Speech API with rolling timestamps, speaker identification, and `.txt` transcript export.
* **Procedural Ambient Sound Mixer (AmbientSoundMixer.jsx)**: In-browser audio generator with 8 soundscapes (Rain, Coffee Shop, Forest, Ocean, Fireplace, Lo-fi Beats, Office Hum, Thunderstorm) synthesized dynamically using the Web Audio API.
* **Smart Agenda Timer (AgendaTimer.jsx)**: Configurable countdown timers with overtime visual indicators and colored progress bars.
* **Collaborative Whiteboard (Whiteboard.jsx)**: Real-time interactive multi-user vector and freehand canvas powered by Socket.IO synchronization.

---

## Chronological Authorship & Milestones

* **May 08, 2026**: Initial smart contract scaffolding, WebRTC mesh setup, and multi-tier backend initialization by **Vinay G K**.
* **May 14, 2026**: Embedded wallet design spec, drip faucet backend, and Amoy RPC integration.
* **May 22, 2026**: Repository suite formalization (`EtherXMeet-suite`).
* **June 2026**: Full WebRTC overhaul, ambient sound mixer, live transcription, and agenda timer.
* **July 2026**: Web3Auth wallet integration, room media sharing, and backend token-gating.
* **August 2026**: NxtMeet brand transition, mobile responsive hardening, and production packaging.

---

## Legal & Attribution Notice

This repository and all proprietary architectures contained within are the sole copyrighted work of **Vinay G K**.

Any team member, collaborator, or institution wishing to reference or showcase this project must do so via a formal **GitHub Fork** or with explicit written attribution crediting **Vinay G K** as the original author.
