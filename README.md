# RPOS – Refinery PO System: Technical Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend Documentation](#2-frontend-documentation)
3. [Backend Documentation](#3-backend-documentation)
4. [Development & Setup](#4-development--setup)

---

## 1. System Overview

### Purpose

RPOS (Refinery PO System) is a web-based Purchase Order management application designed for refinery procurement teams. It enables users to browse a catalog of industrial equipment, compose multi-line purchase orders, and track them through a defined lifecycle (Draft → Submitted → Approved → Fulfilled).

### High-Level Architecture

```
┌──────────────────────────┐
│      React SPA (Vite)    │
│  Tailwind · shadcn/ui    │
│  TanStack Query · Router │
└──────────┬───────────────┘
           │  HTTPS / JSON
           ▼
┌──────────────────────────────────────────┐
│        Supabase Edge Functions            │
│  ┌──────────────┐  ┌──────────────────┐  │
│  │ catalog-     │  │ procurement-     │  │
│  │ service      │  │ service          │  │
│  └──────┬───────┘  └────────┬─────────┘  │
│         │                   │            │
│         ▼                   ▼            │
│  ┌──────────────────────────────────┐    │
│  │   PostgreSQL (Supabase Cloud)    │    │
│  │  catalog_items · purchase_orders │    │
│  │  po_line_items · po_status_hist  │    │
│  └──────────────────────────────────┘    │
└──────────────────────────────────────────┘
```

### Data Flow

1. **Catalog Browsing** — The SPA calls `catalog-service` Edge Function → queries `catalog_items` table → returns paginated, filtered results.
2. **Draft Creation** — User adds items → `PODraftContext` calls `procurement-service` to create a draft PO and add line items in real-time.
3. **Submission** — User fills PO header fields → context PATCHes the header → POSTs to `/submit` → backend transitions status to "Submitted."
4. **Lifecycle Management** — `OrderDetailPage` allows status transitions (Approve, Reject, Fulfill) via `POST /orders/:id/status`.

---

## 2. Frontend Documentation

### Technology Stack

| Technology               | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| **React 18**             | UI library                                       |
| **TypeScript**           | Static typing                                    |
| **Vite**                 | Build tool & dev server                          |
| **Tailwind CSS**         | Utility-first styling                            |
| **shadcn/ui**            | Pre-built accessible UI components               |
| **TanStack React Query** | Server-state management, caching, and refetching |
| **React Router v6**      | Client-side routing                              |
| **Lucide React**         | Icon library                                     |
| **IBM Plex Sans/Mono**   | Typography (Google Fonts)                        |

### Project Structure

```
src/
├── App.tsx                    # Root component: providers, routing
├── main.tsx                   # Entry point
├── index.css                  # Design tokens (CSS custom properties)
├── lib/
│   ├── api.ts                 # HTTP client & typed API functions
│   └── utils.ts               # Utility functions (cn helper)
├── types/
│   └── po.ts                  # Domain types (CatalogItem, POHeader, PurchaseOrder, etc.)
├── context/
│   └── PODraftContext.tsx      # PO draft state management (React Context + API calls)
├── hooks/
│   ├── use-catalog.ts         # React Query hook for catalog fetching
│   ├── use-debounce.ts        # Debounce hook for search input
│   ├── use-mobile.tsx         # Responsive breakpoint hook
│   └── use-toast.ts           # Toast notification hook
├── pages/
│   ├── CatalogPage.tsx        # Browse & search catalog items
│   ├── DraftPage.tsx          # Multi-step PO creation wizard
│   ├── OrdersPage.tsx         # PO listing table
│   ├── OrderDetailPage.tsx    # Single PO detail with status transitions
│   ├── Index.tsx              # (redirects to Catalog)
│   └── NotFound.tsx           # 404 page
├── components/
│   ├── AppHeader.tsx          # Top navigation bar
│   ├── AppFooter.tsx          # Footer
│   ├── CatalogCard.tsx        # Individual catalog item card
│   ├── NavLink.tsx            # Active-aware navigation link
│   └── ui/                    # shadcn/ui component library (50+ components)
└── integrations/
    └── supabase/
        ├── client.ts          # Auto-generated Supabase JS client
        └── types.ts           # Auto-generated database types
```

## 3. Backend Documentation

### Technology Stack & Architecture

| Technology                                 | Purpose                        |
| ------------------------------------------ | ------------------------------ |
| **Supabase Edge Functions** (Deno runtime) | Serverless API layer           |
| **PostgreSQL** (Supabase-managed)          | Relational database            |
| **supabase-js v2**                         | Database client (service role) |

**Architecture Pattern:** Microservices-inspired — two independent edge functions acting as service boundaries:

1. **`catalog-service`** — Read-only catalog operations
2. **`procurement-service`** — Full CRUD for purchase orders, line items, and status transitions

Both services use the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS, enforcing business logic in application code.

### Project Structure

```
supabase/
├── config.toml                          # Edge function configuration (JWT disabled)
├── functions/
│   ├── catalog-service/
│   │   └── index.ts                     # Catalog API (144 lines)
│   ├── procurement-service/
│   │   └── index.ts                     # Procurement API (442 lines)
│   └── seed-catalog/
│       └── index.ts                     # One-time data seeder
└── migrations/                          # SQL migration files (auto-managed)
```

### Database Design

#### Entity-Relationship Diagram

```
┌──────────────────┐
│  catalog_items   │
│──────────────────│
│ id (PK, text)    │◄────────┐
│ name             │         │
│ category         │         │
│ supplier         │         │
│ manufacturer     │         │
│ model            │         │
│ price_usd        │         │
│ lead_time_days   │         │
│ in_stock         │         │
│ description      │         │
│ specs (jsonb)    │         │
│ compatible_with  │         │
│ search_vector    │         │
└──────────────────┘         │
                             │
┌──────────────────┐    ┌────┴──────────────┐
│ purchase_orders  │    │  po_line_items     │
│──────────────────│    │───────────────────│
│ id (PK, uuid)    │◄───│ po_id (FK)        │
│ po_number (seq)  │    │ catalog_item_id(FK)│──►catalog_items.id
│ supplier         │    │ quantity           │
│ requestor        │    │ unit_price         │
│ cost_center      │    │ line_total (calc)  │
│ needed_by_date   │    │ id (PK, uuid)      │
│ payment_terms    │    └───────────────────┘
│ current_status   │
│ total_amount     │    ┌───────────────────┐
│ idempotency_key  │    │ po_status_history  │
│ created_at       │    │───────────────────│
│ updated_at       │    │ id (PK, uuid)      │
└──────────────────┘◄───│ po_id (FK)         │
                        │ status (enum)      │
                        │ transitioned_at    │
                        │ note               │
                        └───────────────────┘
```

##### `PATCH /procurement-service/orders/:id`

Update header fields on a Draft PO. Accepts: `requestor`, `costCenter`, `neededByDate`, `paymentTerms`.

##### `POST /procurement-service/orders/:id/lines`

Add a line item (or upsert if same catalog item already exists).

**Request:** `{ "catalogItemId": "VALVE-001", "quantity": 5 }`

**Validation:** Supplier must match PO supplier (409 on mismatch). Quantity 1–10,000.

##### `PATCH /procurement-service/orders/:id/lines/:lineId`

Update line item quantity. **Request:** `{ "quantity": 10 }`

##### `DELETE /procurement-service/orders/:id/lines/:lineId`

Remove a line item from a Draft PO.

##### `POST /procurement-service/orders/:id/submit`

Transition a Draft PO to Submitted. Requires at least one line item (422 if empty).

##### `POST /procurement-service/orders/:id/status`

Transition PO status. **Request:** `{ "status": "Approved", "note": "Looks good" }`

Valid transitions: Submitted→Approved, Submitted→Rejected, Approved→Fulfilled, Rejected→Draft.

### Authentication / Authorization

The current system does **not** implement user authentication. All endpoints are publicly accessible (JWT verification is disabled in `config.toml`). RLS policies restrict direct database writes — all mutations go through edge functions using the service role key.

---

## 4. Development & Setup

### Prerequisites

- **Node.js** ≥ 18.x (or Bun)
- **npm** (or bun)
- **Git**

### Environment Variables

| Variable                        | Description              |
| ------------------------------- | ------------------------ |
| `VITE_SUPABASE_URL`             | Supabase project API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID`      | Supabase project ID      |

Edge functions have access to:

| Secret                      | Description                     |
| --------------------------- | ------------------------------- |
| `SUPABASE_URL`              | Supabase project URL            |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `SUPABASE_ANON_KEY`         | Anon key                        |

### Local Development Setup

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server (runs on port 8080)
npm run dev
```

The app will be available at `http://localhost:8080`.

### Build & Deployment

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

---
