const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function request<T>(fn: string, path: string, options?: RequestInit): Promise<T> {
  const url = `${SUPABASE_URL}/functions/v1/${fn}${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || body.detail || res.statusText, body);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Catalog Service ──

export interface CatalogApiItem {
  id: string;
  name: string;
  category: string;
  supplier: string;
  manufacturer: string;
  model: string;
  price_usd: number;
  lead_time_days: number;
  in_stock: boolean;
  description: string;
  specs?: Record<string, string>;
  compatible_with?: string[];
}

export interface CatalogResponse {
  items: CatalogApiItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function fetchCatalog(params: Record<string, string>): Promise<CatalogResponse> {
  const qs = new URLSearchParams(params).toString();
  return request("catalog-service", `/items${qs ? `?${qs}` : ""}`);
}

export function fetchCatalogItem(id: string): Promise<CatalogApiItem> {
  return request("catalog-service", `/items/${id}`);
}

// ── Procurement Service ──

export interface POApiResponse {
  id: string;
  po_number: string;
  supplier: string;
  requestor: string;
  cost_center: string;
  needed_by_date: string | null;
  payment_terms: string;
  current_status: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  idempotency_key?: string | null;
  lineItems?: POLineItemApi[];
  statusHistory?: POStatusHistoryApi[];
}

export interface POLineItemApi {
  id: string;
  po_id: string;
  catalog_item_id: string;
  quantity: number;
  unit_price: number;
  line_total: number | null;
  catalog_item?: CatalogApiItem;
}

export interface POStatusHistoryApi {
  id: string;
  po_id: string;
  status: string;
  transitioned_at: string;
  note: string | null;
}

export interface POListResponse {
  orders: POApiResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function createDraftPO(body: {
  supplier: string;
  requestor: string;
  costCenter?: string;
  neededByDate?: string;
  paymentTerms?: string;
}): Promise<POApiResponse> {
  return request("procurement-service", "/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchOrders(params?: Record<string, string>): Promise<POListResponse> {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return request("procurement-service", `/orders${qs ? `?${qs}` : ""}`);
}

export function fetchOrder(id: string): Promise<POApiResponse> {
  return request("procurement-service", `/orders/${id}`);
}

export function addLineItem(poId: string, catalogItemId: string, quantity: number): Promise<POLineItemApi> {
  return request("procurement-service", `/orders/${poId}/lines`, {
    method: "POST",
    body: JSON.stringify({ catalogItemId, quantity }),
  });
}

export function updateLineItem(poId: string, lineId: string, quantity: number): Promise<POLineItemApi> {
  return request("procurement-service", `/orders/${poId}/lines/${lineId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function updatePOHeader(poId: string, header: {
  requestor?: string;
  costCenter?: string;
  neededByDate?: string;
  paymentTerms?: string;
}): Promise<POApiResponse> {
  return request("procurement-service", `/orders/${poId}`, {
    method: "PATCH",
    body: JSON.stringify(header),
  });
}

export function deleteLineItem(poId: string, lineId: string): Promise<{ success: boolean }> {
  return request("procurement-service", `/orders/${poId}/lines/${lineId}`, {
    method: "DELETE",
  });
}

export function submitPO(poId: string): Promise<POApiResponse> {
  return request("procurement-service", `/orders/${poId}/submit`, {
    method: "POST",
  });
}

export function updatePOStatus(poId: string, status: string, note?: string): Promise<POApiResponse> {
  return request("procurement-service", `/orders/${poId}/status`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
}
