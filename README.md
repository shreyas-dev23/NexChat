<div align="center">

# 💬 ChatApp

A real-time chat application built with **Angular** and **SignalR**,
inspired by **WeChat** UI/UX design.

![Angular](https://img.shields.io/badge/Angular-18-DD0031?style=for-the-badge&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![SignalR](https://img.shields.io/badge/SignalR-Real--time-512BD4?style=for-the-badge&logo=dotnet)
![License](https://img.shields.io/badge/License-MIT-07C160?style=for-the-badge)

[Features](#-features) •
[Screenshots](#-screenshots) •
[Getting Started](#-getting-started) •
[Architecture](#-architecture) •
[Contributing](#-contributing)

</div>

---

## ✨ Features

### 💬 Messaging

- ✅ Real-time 1:1 messaging via SignalR
- ✅ Group chat support
- ✅ Message delivery status (Sending → Sent → Read)
- ✅ Message retry on failure
- ✅ Chat history with date separators

### 👥 Users & Groups

- ✅ User online/offline status
- ✅ Last seen timestamps
- ✅ Create group chats
- ✅ Add/remove group members
- ✅ Group info panel

### 🎨 UI/UX

- ✅ WeChat-inspired design
- ✅ Mobile-first responsive layout
- ✅ Typing indicators
- ✅ Unread message badges
- ✅ Custom dialog system (Alert, Confirm, Prompt)
- ✅ Lucide icon system (no emoji icons)
- ✅ Global CSS design system with CSS variables

### 🔐 Auth

- ✅ JWT Authentication
- ✅ Protected routes
- ✅ Auto-reconnect on disconnect

---

## 📸 Screenshots

| Conversations                            | Chat                               | Group Info                           |
| ---------------------------------------- | ---------------------------------- | ------------------------------------ |
| ![Sidebar](docs/screenshots/sidebar.png) | ![Chat](docs/screenshots/chat.png) | ![Group](docs/screenshots/group.png) |

| Login                                | Create Group                                       | Mobile                                 |
| ------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| ![Login](docs/screenshots/login.png) | ![Create Group](docs/screenshots/create-group.png) | ![Mobile](docs/screenshots/mobile.png) |

---

## 🚀 Getting Started

### Prerequisites

```bash
node >= 18.x
npm >= 9.x
Angular CLI >= 18.x
```
