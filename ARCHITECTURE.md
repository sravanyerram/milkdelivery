# Milk Delivery App — Architecture

> **Version:** 0.1.0 · **Last updated:** 2026-02-27

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Authentication & Roles](#authentication--roles)
5. [Database — Firestore Collections](#database--firestore-collections)
6. [Security Rules](#security-rules)
7. [Application Routes](#application-routes)
8. [Core UI Patterns](#core-ui-patterns)
9. [Key Business Flows](#key-business-flows)
10. [Data Service Layer](#data-service-layer)

---

## Overview

**milkdelivery** is a mobile-first, full-stack web application that manages daily milk delivery for a small dairy business. It serves two distinct user roles:

- **Client** — views daily deliveries, manages vacation leave, tracks invoices & disputes.
- **Admin** — manages clients, logs & confirms deliveries, handles disputes, reviews revenue, and generates reports.

The app is built on **Next.js 16 (App Router)** and uses **Firebase** (Auth + Firestore) as the backend with no custom server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, RSC-aware) |
| UI | React 19 + Tailwind CSS v4 |
| Icons | lucide-react |
| Date Utilities | date-fns v4 |
| Calendar Picker | react-day-picker v9 |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore (NoSQL) |
| Hosting | Firebase Hosting (or Vercel) |
| Language | TypeScript 5 |

---

## Project Structure

```
mik-delivery-app/
├── public/                         # Static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root HTML shell, Google font
│   │   ├── page.tsx                # Root redirect (→ /login or /client/dashboard)
│   │   ├── globals.css             # Tailwind base + global styles
│   │   ├── login/                  # /login — Google OAuth sign-in page
│   │   ├── pending/                # /pending — Awaiting admin approval screen
│   │   └── (app)/                  # Authenticated route group
│   │       ├── layout.tsx          # AppLayout: TopHeader + TabBar + auth guard
│   │       ├── admin/
│   │       │   ├── dashboard/      # Admin home — pending users, disputes
│   │       │   ├── clients/        # Client list & profile management
│   │       │   ├── delivery-run/   # Log/confirm today's deliveries
│   │       │   ├── revenue/        # Invoice management & payment recording
│   │       │   ├── reports/        # Analytics & delivery summaries
│   │       │   └── users/          # User approval queue
│   │       └── client/
│   │           ├── dashboard/      # Client home — today's delivery & monthly summary
│   │           ├── invoices/       # Invoice list, dispute thread, payment request
│   │           └── vacation/       # Vacation / leave management
│   ├── components/
│   │   └── ui/                     # Shared UI primitives (buttons, cards, etc.)
│   ├── context/
│   │   └── AuthContext.tsx         # React context: Firebase Auth + UserDoc
│   └── lib/
│       ├── firebase.ts             # Firebase app init (auth, db exports)
│       └── firestore.ts            # All Firestore operations (types + CRUD helpers)
├── firestore.rules                 # Server-side security rules
├── firestore.indexes.json          # Composite index definitions
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Authentication & Roles

```
User visits app
      │
      ▼
  Signed in? ──No──▶ /login (Google Sign-In)
      │ Yes
      ▼
UserDoc exists? ──No──▶ createUser() → /pending
      │ Yes
      ▼
 status == "Approved"? ──No──▶ /pending (show rejection / waiting state)
      │ Yes
      ▼
role == "Admin" ──Yes──▶ /admin/dashboard
      │ No
      ▼
  /client/dashboard
```

### UserDoc roles

| Field | Values |
|---|---|
| `role` | `"Admin"` \| `"Client"` |
| `status` | `"Pending"` \| `"Approved"` \| `"Rejected"` |

New registrations are set to `status: "Pending"` and require Admin approval before accessing the app.

---

## Database — Firestore Collections

### `users/{uid}`

| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `name` | string | Display name |
| `email` | string | Email address |
| `role` | UserRole | `"Admin"` or `"Client"` |
| `status` | UserStatus | `"Pending"` / `"Approved"` / `"Rejected"` |
| `phone` | string? | Contact number |
| `address` | string? | Delivery address |
| `defaultProduct` | string? | Default product ID |
| `defaultQty` | number? | Default daily quantity (litres) |
| `defaultChangedAt` | Timestamp? | Audit: last default change |
| `createdAt` | Timestamp? | Account creation time |

---

### `products/{id}`

| Field | Type | Description |
|---|---|---|
| `name` | `"Buffalo"` \| `"Cow"` | Milk type |
| `price` | number | Price per litre (₹) |

Seeded once via `seedProducts()`. Default price: ₹70/litre.

---

### `deliveries/{id}`

| Field | Type | Description |
|---|---|---|
| `client_uid` | string | Owning client's UID |
| `date` | string | `"YYYY-MM-DD"` |
| `product_id` | string | Reference to product |
| `product_name` | string | Denormalized name |
| `quantity` | number | Litres delivered (admin value) |
| `total_cost` | number | `quantity × price` |
| `source` | `"client"` \| `"admin"` | Who created this entry |
| `confirmed` | boolean | Admin confirmed physical delivery |
| `confirmedAt` | Timestamp? | When confirmed |
| `disputed` | boolean? | Client raised a quantity dispute |
| `client_quantity` | number? | Quantity claimed by client |
| `dispute_status` | string? | `"Pending"` / `"Approved"` / `"Rejected"` |
| `dispute_note` | string? | Client's dispute reason |
| `createdAt` | Timestamp? | Record creation time |

---

### `invoices/{id}`

| Field | Type | Description |
|---|---|---|
| `client_uid` | string | Owning client's UID |
| `month_year` | string | `"YYYY-MM"` |
| `total_amount` | number | Sum of confirmed deliveries |
| `amount_paid` | number? | Cumulative payments confirmed by admin |
| `status` | InvoiceStatus | `"Unpaid"` / `"Pending"` / `"Confirmed"` |
| `dispute_notes` | DisputeNote[]? | Thread of admin ↔ client notes |
| `updatedAt` | Timestamp? | Last modification time |

#### InvoiceStatus transitions

```
Unpaid ──(client requests payment)──▶ Pending
Pending ──(admin confirms payment)──▶ Confirmed  (if amount_paid >= total_amount)
Pending ──(admin declines payment)──▶ Unpaid
```

---

### `vacations/{id}`

| Field | Type | Description |
|---|---|---|
| `client_uid` | string | Owning client's UID |
| `start_date` | string | `"YYYY-MM-DD"` |
| `end_date` | string | `"YYYY-MM-DD"` |
| `reason` | string? | Optional leave reason |
| `createdAt` | Timestamp? | Creation time |

---

### `settings/{key}`

Generic key-value store for admin-configurable settings (e.g., payment thresholds).

| Field | Type | Description |
|---|---|---|
| `value` | any | Setting value |

---

## Security Rules

Firestore rules enforce role-based access at the document level:

| Collection | Read | Write |
|---|---|---|
| `users` | Owner or Admin | Owner (create), Admin or Owner (update) |
| `products` | Any signed-in user | Admin only |
| `deliveries` | Admin or owner client | Admin or owner client |
| `invoices` | Admin or owner client | Admin or owner client |
| `vacations` | Admin or owner client | Any signed-in (create), Admin or owner (update/delete) |
| `settings` | Any signed-in user | Admin only |

Role is determined by reading `users/{uid}.role` in a Firestore helper function.

---

## Application Routes

### Client routes (`/client/...`)

| Route | Page | Purpose |
|---|---|---|
| `/client/dashboard` | Dashboard | Today's delivery card, monthly stats, default override |
| `/client/invoices` | Invoices | Invoice list, dispute thread, mark-as-paid request |
| `/client/vacation` | Leave | Book/view/cancel vacation dates |

### Admin routes (`/admin/...`)

| Route | Page | Purpose |
|---|---|---|
| `/admin/dashboard` | Dashboard | Pending users, open disputes, quick overview |
| `/admin/clients` | Clients | Full client list, view/edit client profile |
| `/admin/delivery-run` | Delivery Run | Log & confirm today's deliveries for all clients |
| `/admin/revenue` | Finance | Invoice list, record payments, decline payment |
| `/admin/reports` | Reports | Delivery analytics, monthly summaries |
| `/admin/users` | Users | Approve / reject pending user registrations |

### Auth routes

| Route | Purpose |
|---|---|
| `/login` | Google Sign-In entry point |
| `/pending` | Shown while account awaits approval |

---

## Core UI Patterns

### AppLayout (`src/app/(app)/layout.tsx`)

Wraps all authenticated pages. Responsibilities:

- **Auth guard** — redirects unauthenticated or unapproved users.
- **`TopHeader`** — sticky brand bar with user avatar and sign-out button.
- **`TabBar`** — fixed bottom navigation; dynamically switches between Client and Admin tab sets.
- **Live notification badge** — `useAdminBadge` hook uses Firestore `onSnapshot` to show real-time counts of open disputes + pending user approvals on the Admin Dashboard tab.

### Theme

- Dark mode first: `bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950`
- Glassmorphism surfaces: `backdrop-blur-xl bg-white/5 border border-white/10`
- Accent: blue-400 / indigo-400

---

## Key Business Flows

### 1. New Client Onboarding

```
Client signs in with Google
      → UserDoc created (status: Pending)
      → Redirected to /pending
      → Admin sees badge on dashboard
      → Admin approves via /admin/users
      → Client gains access to /client/dashboard
```

### 2. Daily Delivery Logging

```
Admin visits /admin/delivery-run (today's date)
      → Sees all approved clients with their defaults pre-filled
      → Admin logs/confirms deliveries
      → Each confirmed delivery creates/updates a DeliveryDoc (confirmed: true)
      → recalcInvoice() recalculates monthly invoice total from confirmed deliveries
```

### 3. Delivery Dispute Flow

```
Client notices incorrect quantity on dashboard
      → Client raises dispute: raiseDeliveryDispute(deliveryId, clientQty, note)
      → DeliveryDoc: disputed=true, client_quantity=X, dispute_status="Pending"
      → Admin sees badge; reviews on /admin/dashboard
      → Admin approves: quantity corrected, recalcInvoice() updates invoice total
      → Admin rejects: dispute_status="Rejected", quantity unchanged
```

### 4. Payment Flow

```
Client views invoice on /client/invoices
      → Client marks invoice as "Pending" (payment sent)
      → Admin sees invoice in /admin/revenue
      → Admin records actual amount: recordPayment(invoiceId, amount)
      → amount_paid accumulates; status → "Confirmed" when fully paid
      → Admin can also decline → status resets to "Unpaid"
```

---

## Data Service Layer

All Firestore interactions are centralised in `src/lib/firestore.ts`. The module exports typed interfaces and async functions grouped by domain:

| Domain | Key Functions |
|---|---|
| **Users** | `getUser`, `createUser`, `updateUser`, `getAllUsers`, `getApprovedClients`, `getPendingUsers` |
| **Products** | `getProducts`, `seedProducts` |
| **Deliveries** | `logDelivery`, `confirmDelivery`, `getDeliveriesForClient`, `getTodayDeliveriesAdmin` |
| **Disputes** | `raiseDeliveryDispute`, `resolveDeliveryDispute`, `getDisputedDeliveries` |
| **Invoices** | `upsertInvoice`, `recalcInvoice`, `getAllInvoices`, `getInvoicesForClient`, `updateInvoiceStatus` |
| **Payments** | `recordPayment`, `declinePayment` |
| **Invoice Notes** | `addDisputeNote` |
| **Vacations** | `saveVacation`, `deleteVacation`, `getVacationsForClient`, `getAllVacations` |
| **Settings** | `getAdminSetting`, `setAdminSetting` |

> **Client defaults** — stored directly on `UserDoc` (`defaultProduct`, `defaultQty`) so the delivery-run page can pre-fill quantities without an extra collection read.

> **Index strategy** — composite Firestore indexes are avoided where possible; secondary filters are applied in JavaScript after single-field queries, keeping `firestore.indexes.json` minimal.

---

*This document reflects the codebase as of February 2026.*
