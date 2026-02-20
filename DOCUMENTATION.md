# RPOS – Refinery PO System: Technical Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend Documentation](#2-frontend-documentation)
3. [Backend Documentation](#3-backend-documentation)
4. [Development & Setup](#4-development--setup)
5. [Limitations & Future Improvements](#6-limitations--future-improvements)

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

### State Management

| Concern                                   | Approach                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Server state** (catalog items, orders)  | TanStack React Query with automatic caching and invalidation                                             |
| **Draft PO state** (line items, header)   | React Context (`PODraftContext`) — lives for the session, syncs each mutation to the backend immediately |
| **URL state** (search, filters, sort)     | React Router `useSearchParams` with debounced sync                                                       |
| **UI state** (wizard step, loading flags) | Local `useState` within page components                                                                  |

### Routing

| Route         | Component         | Description                                         |
| ------------- | ----------------- | --------------------------------------------------- |
| `/`           | `CatalogPage`     | Equipment catalog with search, filter, sort         |
| `/draft`      | `DraftPage`       | 3-step PO creation wizard (Items → Header → Review) |
| `/orders`     | `OrdersPage`      | List all purchase orders                            |
| `/orders/:id` | `OrderDetailPage` | PO detail with status timeline & transitions        |
| `*`           | `NotFound`        | 404 fallback                                        |

### API Integration (`src/lib/api.ts`)

The `api.ts` module provides a typed HTTP client wrapping `fetch`. All calls go through a `request<T>()` helper that:

- Prepends the Supabase Functions URL
- Attaches `apikey` and `Authorization` headers (using the publishable anon key)
- Parses JSON responses
- Throws `ApiError` with status code and body on non-2xx responses

**Key functions:**

| Function                                | Method | Endpoint                                        | Purpose                                    |
| --------------------------------------- | ------ | ----------------------------------------------- | ------------------------------------------ |
| `fetchCatalog(params)`                  | GET    | `/catalog-service/items`                        | Search/filter/paginate catalog             |
| `fetchCatalogItem(id)`                  | GET    | `/catalog-service/items/:id`                    | Single catalog item                        |
| `createDraftPO(body)`                   | POST   | `/procurement-service/orders`                   | Create draft PO                            |
| `fetchOrders(params)`                   | GET    | `/procurement-service/orders`                   | List POs                                   |
| `fetchOrder(id)`                        | GET    | `/procurement-service/orders/:id`               | PO detail with line items & history        |
| `addLineItem(poId, catalogItemId, qty)` | POST   | `/procurement-service/orders/:id/lines`         | Add/upsert line item                       |
| `updateLineItem(poId, lineId, qty)`     | PATCH  | `/procurement-service/orders/:id/lines/:lineId` | Update quantity                            |
| `deleteLineItem(poId, lineId)`          | DELETE | `/procurement-service/orders/:id/lines/:lineId` | Remove line item                           |
| `updatePOHeader(poId, header)`          | PATCH  | `/procurement-service/orders/:id`               | Update header fields                       |
| `submitPO(poId)`                        | POST   | `/procurement-service/orders/:id/submit`        | Transition Draft → Submitted               |
| `updatePOStatus(poId, status, note?)`   | POST   | `/procurement-service/orders/:id/status`        | Transition status (Approve/Reject/Fulfill) |

---

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

#### Status Enum (`po_status`)

```
Draft → Submitted → Approved → Fulfilled
                  → Rejected → Draft (re-open)
```

#### Database Triggers

| Trigger                      | Table             | Purpose                                               |
| ---------------------------- | ----------------- | ----------------------------------------------------- |
| `generate_po_number`         | `purchase_orders` | Auto-generates `PO-XXXXXX` from sequence on INSERT    |
| `validate_status_transition` | `purchase_orders` | Enforces valid status transitions on UPDATE           |
| `record_status_change`       | `purchase_orders` | Inserts row into `po_status_history` on status change |
| `enforce_single_supplier`    | `po_line_items`   | Prevents adding items from a different supplier       |
| `recalculate_po_total`       | `po_line_items`   | Recomputes `total_amount` on INSERT/UPDATE/DELETE     |
| `set_updated_at`             | `purchase_orders` | Auto-updates `updated_at` timestamp                   |

#### Row-Level Security

All four tables have RLS enabled with **read-only public access**. Write operations are performed via edge functions using the service role key, which bypasses RLS.

| Table               | SELECT    | INSERT/UPDATE/DELETE           |
| ------------------- | --------- | ------------------------------ |
| `catalog_items`     | ✅ Public | ❌ Blocked (service role only) |
| `purchase_orders`   | ✅ Public | ❌ Blocked (service role only) |
| `po_line_items`     | ✅ Public | ❌ Blocked (service role only) |
| `po_status_history` | ✅ Public | ❌ Blocked (service role only) |

### API Endpoints

#### Catalog Service

##### `GET /catalog-service/items`

Search, filter, sort, and paginate catalog items.

**Query Parameters:**

| Param      | Type             | Default     | Description                                                               |
| ---------- | ---------------- | ----------- | ------------------------------------------------------------------------- |
| `q`        | string           | —           | Free-text search (name, id, supplier, manufacturer, model)                |
| `category` | string           | —           | Exact category filter                                                     |
| `supplier` | string           | —           | Exact supplier filter                                                     |
| `inStock`  | `"true"/"false"` | —           | Stock availability filter                                                 |
| `sort`     | string           | `price-asc` | One of: `price-asc`, `price-desc`, `lead-asc`, `lead-desc`, `supplier-az` |
| `page`     | int              | 1           | Page number (1–1000)                                                      |
| `limit`    | int              | 50          | Items per page (1–100)                                                    |

**Response (200):**

```json
{
  "items": [
    {
      "id": "VALVE-001",
      "name": "Ball Valve 2\" 150#",
      "category": "Valve",
      "supplier": "FlowTech Industries",
      "manufacturer": "Emerson",
      "model": "DVC-2000",
      "description": "...",
      "price_usd": 1250.0,
      "lead_time_days": 14,
      "in_stock": true,
      "specs": { "size": "2\"", "pressure_class": "150#" },
      "compatible_with": ["GASKET-001"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 42,
    "totalPages": 1
  }
}
```

##### `GET /catalog-service/items/:id`

Returns a single catalog item by ID.

##### `GET /catalog-service/categories`

Returns distinct category names: `{ "categories": ["Gasket", "Valve", ...] }`

##### `GET /catalog-service/suppliers`

Returns distinct supplier names: `{ "suppliers": ["FlowTech Industries", ...] }`

---

#### Procurement Service

##### `POST /procurement-service/orders`

Create a new draft purchase order.

**Request Body:**

```json
{
  "supplier": "FlowTech Industries",
  "requestor": "John Doe",
  "costCenter": "CC-1234",
  "neededByDate": "2026-03-15",
  "paymentTerms": "Net 30"
}
```

- `supplier` — Required (max 255 chars)
- `requestor` — Optional (max 255 chars)
- `costCenter` — Optional (max 100 chars)
- `neededByDate` — Optional (YYYY-MM-DD)
- `paymentTerms` — Optional (max 50 chars, default "Net 30")

**Headers (optional):** `x-idempotency-key: <UUID>` — prevents duplicate creation.

**Response (201):**

```json
{
  "id": "aa5f289f-0101-4afe-a2d5-9d6500434085",
  "po_number": "PO-000042",
  "supplier": "FlowTech Industries",
  "requestor": "John Doe",
  "cost_center": "CC-1234",
  "needed_by_date": "2026-03-15",
  "payment_terms": "Net 30",
  "current_status": "Draft",
  "total_amount": 0,
  "created_at": "2026-02-19T...",
  "updated_at": "2026-02-19T..."
}
```

##### `GET /procurement-service/orders`

List purchase orders with optional filters.

**Query Parameters:**

| Param      | Type   | Default | Description                                                        |
| ---------- | ------ | ------- | ------------------------------------------------------------------ |
| `status`   | string | —       | Filter by status (Draft, Submitted, Approved, Rejected, Fulfilled) |
| `supplier` | string | —       | Filter by supplier                                                 |
| `page`     | int    | 1       | Page number                                                        |
| `limit`    | int    | 20      | Items per page (1–100)                                             |

**Response (200):**

```json
{
  "orders": [ { ...PO object } ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

##### `GET /procurement-service/orders/:id`

Single PO with embedded line items (including catalog item details) and status history.

**Response (200):**

```json
{
  "id": "...",
  "po_number": "PO-000042",
  "supplier": "FlowTech Industries",
  "current_status": "Submitted",
  "total_amount": 12500,
  "lineItems": [
    {
      "id": "...",
      "po_id": "...",
      "catalog_item_id": "VALVE-001",
      "quantity": 10,
      "unit_price": 1250,
      "line_total": 12500,
      "catalog_item": { ...full catalog item }
    }
  ],
  "statusHistory": [
    { "id": "...", "status": "Draft", "transitioned_at": "...", "note": "PO created" },
    { "id": "...", "status": "Submitted", "transitioned_at": "...", "note": "" }
  ]
}
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

## 5. Limitations & Future Improvements

### Current Limitations

1. **No Authentication** — Any user can create, view, and transition POs. No role-based access control.
2. **No Audit Trail for User Identity** — No `created_by` or `approved_by` fields; status changes lack user attribution.
3. **Draft PO Not Persisted Client-Side** — Refreshing the browser loses the in-progress draft wizard state.
4. **Single-Page Pagination** — Catalog and orders pages fetch up to 100 items; no infinite scroll or deep pagination.
5. **No File Attachments** — No support for uploading specs, quotes, or supporting documents.
6. **No Email Notifications** — Status transitions don't trigger notifications.
7. **No Approval Workflow** — No multi-level approval chains or delegation.
8. **No Dark Mode Toggle** — Dark mode CSS tokens are defined but no UI toggle exists.

### Known Issues

- The procurement service edge function is 442+ lines and should be refactored into smaller modules.
- Catalog search uses `ilike` which may be slow on large datasets (trigram index exists but isn't leveraged for `ilike` queries).

### Suggested Enhancements

1. **User Authentication & RBAC** — Add login/signup, role-based permissions (Requester, Approver, Admin).
2. **Draft Persistence** — Save draft state to `localStorage` or a backend `draft_orders` table.
3. **Approval Workflows** — Multi-level approval chains with configurable rules.
4. **Email/Slack Notifications** — Notify approvers on submission, requestors on approval/rejection.
5. **Document Attachments** — Supabase Storage integration for specs and quotes.
6. **Export to PDF/CSV** — Generate PO documents for printing or ERP import.
7. **Dashboard & Analytics** — Spending trends, supplier performance, lead time tracking.
8. **Dark Mode Toggle** — Leverage existing CSS variables for theme switching.
9. **Full-Text Search** — Use the existing `search_vector` tsvector column for PostgreSQL full-text search.
10. **Procurement Service Refactor** — Split into route handlers for maintainability.
