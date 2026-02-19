export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  supplier: string;
  manufacturer: string;
  model: string;
  priceUsd: number;
  leadTimeDays: number;
  inStock: boolean;
  description: string;
  specs?: Record<string, string>;
  compatibleWith?: string[];
}

export interface POLineItem {
  catalogItem: CatalogItem;
  quantity: number;
}

export interface POHeader {
  requestor: string;
  costCenter: string;
  neededByDate: string;
  paymentTerms: string;
}

export type POStatus = "Draft" | "Submitted" | "Approved" | "Rejected" | "Fulfilled";

export interface POStatusEntry {
  status: POStatus;
  timestamp: string;
  note?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  header: POHeader;
  lineItems: POLineItem[];
  supplier: string;
  totalAmount: number;
  currentStatus: POStatus;
  statusHistory: POStatusEntry[];
  createdAt: string;
}

export type SortOption =
  | "price-asc"
  | "price-desc"
  | "lead-asc"
  | "lead-desc"
  | "supplier-az";

export const SORT_LABELS: Record<SortOption, string> = {
  "price-asc": "Price Low → High",
  "price-desc": "Price High → Low",
  "lead-asc": "Lead Time Low → High",
  "lead-desc": "Lead Time High → Low",
  "supplier-az": "Supplier A–Z",
};

export const CATEGORIES = [
  "Gasket",
  "Valve",
  "Pump",
  "Instrumentation",
  "Heat Exchanger",
  "Hand Tool",
] as const;

export const PAYMENT_TERMS = [
  "Net 30",
  "Net 60",
  "Net 90",
  "Due on Receipt",
  "2/10 Net 30",
] as const;
