import React, { createContext, useContext, useState, useCallback } from "react";
import { CatalogItem, POLineItem, POHeader, PurchaseOrder, POStatus, POStatusEntry } from "@/types/po";
import {
  createDraftPO,
  addLineItem,
  deleteLineItem,
  updateLineItem as apiUpdateLine,
  submitPO,
  fetchOrder,
  updatePOHeader,
  POApiResponse,
  POLineItemApi,
  CatalogApiItem,
} from "@/lib/api";

interface PODraftState {
  poId: string | null; // backend PO id for draft
  lineItems: (POLineItem & { lineId: string })[];
  supplier: string | null;
  header: POHeader | null;
  totalAmount: number;
}

interface POContextType {
  draft: PODraftState;
  addItem: (item: CatalogItem, quantity?: number) => Promise<{ success: boolean; error?: string }>;
  removeItem: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  setHeader: (header: POHeader) => void;
  submitOrder: () => Promise<PurchaseOrder>;
  clearDraft: () => void;
  getDraftTotal: () => number;
  isLoading: boolean;
}

const defaultDraft: PODraftState = { poId: null, lineItems: [], supplier: null, header: null, totalAmount: 0 };

const POContext = createContext<POContextType | null>(null);

export const usePOContext = () => {
  const ctx = useContext(POContext);
  if (!ctx) throw new Error("usePOContext must be used within POProvider");
  return ctx;
};

function apiItemToCatalogItem(ci: CatalogApiItem): CatalogItem {
  return {
    id: ci.id,
    name: ci.name,
    category: ci.category,
    supplier: ci.supplier,
    manufacturer: ci.manufacturer,
    model: ci.model,
    priceUsd: Number(ci.price_usd),
    leadTimeDays: ci.lead_time_days,
    inStock: ci.in_stock,
    description: ci.description,
    specs: ci.specs as Record<string, string> | undefined,
    compatibleWith: ci.compatible_with ?? undefined,
  };
}

export const POProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [draft, setDraft] = useState<PODraftState>(defaultDraft);
  const [isLoading, setIsLoading] = useState(false);

  const addItem = useCallback(async (item: CatalogItem, quantity = 1): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      let poId = draft.poId;

      // If no draft PO exists, create one
      if (!poId) {
        const po = await createDraftPO({
          supplier: item.supplier,
          requestor: "", // will be set in header step
        });
        poId = po.id;
      }

      // Add line item to backend
      const line = await addLineItem(poId, item.id, quantity);

      setDraft((prev) => {
        const existing = prev.lineItems.find((li) => li.catalogItem.id === item.id);
        if (existing) {
          return {
            ...prev,
            poId,
            lineItems: prev.lineItems.map((li) =>
              li.catalogItem.id === item.id
                ? { ...li, quantity: line.quantity, lineId: line.id }
                : li
            ),
            totalAmount: prev.totalAmount + item.priceUsd * quantity,
          };
        }
        return {
          ...prev,
          poId,
          supplier: prev.supplier || item.supplier,
          lineItems: [
            ...prev.lineItems,
            { catalogItem: item, quantity: line.quantity, lineId: line.id },
          ],
          totalAmount: prev.totalAmount + item.priceUsd * quantity,
        };
      });

      return { success: true };
    } catch (err: any) {
      if (err.status === 409) {
        return { success: false, error: err.message };
      }
      return { success: false, error: err.message || "Failed to add item" };
    } finally {
      setIsLoading(false);
    }
  }, [draft.poId]);

  const removeItem = useCallback(async (itemId: string) => {
    const line = draft.lineItems.find((li) => li.catalogItem.id === itemId);
    if (!line || !draft.poId) return;

    setIsLoading(true);
    try {
      await deleteLineItem(draft.poId, line.lineId);
      setDraft((prev) => {
        const newItems = prev.lineItems.filter((li) => li.catalogItem.id !== itemId);
        return {
          ...prev,
          lineItems: newItems,
          supplier: newItems.length === 0 ? null : prev.supplier,
          poId: newItems.length === 0 ? null : prev.poId,
          totalAmount: newItems.reduce((s, li) => s + li.catalogItem.priceUsd * li.quantity, 0),
        };
      });
    } finally {
      setIsLoading(false);
    }
  }, [draft.poId, draft.lineItems]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    const line = draft.lineItems.find((li) => li.catalogItem.id === itemId);
    if (!line || !draft.poId) return;

    setIsLoading(true);
    try {
      await apiUpdateLine(draft.poId, line.lineId, quantity);
      setDraft((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((li) =>
          li.catalogItem.id === itemId ? { ...li, quantity } : li
        ),
        totalAmount: prev.lineItems.reduce(
          (s, li) => s + li.catalogItem.priceUsd * (li.catalogItem.id === itemId ? quantity : li.quantity),
          0
        ),
      }));
    } finally {
      setIsLoading(false);
    }
  }, [draft.poId, draft.lineItems]);

  const setHeader = useCallback((header: POHeader) => {
    setDraft((prev) => ({ ...prev, header }));
  }, []);

  const getDraftTotal = useCallback(() => {
    return draft.lineItems.reduce((sum, li) => sum + li.catalogItem.priceUsd * li.quantity, 0);
  }, [draft.lineItems]);

  const submitOrderFn = useCallback(async (): Promise<PurchaseOrder> => {
    if (!draft.poId) throw new Error("No draft PO to submit");

    // Update header fields on backend before submitting
    if (draft.header) {
      await updatePOHeader(draft.poId, {
        requestor: draft.header.requestor,
        costCenter: draft.header.costCenter,
        neededByDate: draft.header.neededByDate,
        paymentTerms: draft.header.paymentTerms,
      });
    }
    const result = await submitPO(draft.poId);

    // Fetch full details
    const full = await fetchOrder(draft.poId);

    const po: PurchaseOrder = {
      id: full.id,
      poNumber: full.po_number,
      header: draft.header || { requestor: full.requestor, costCenter: full.cost_center, neededByDate: full.needed_by_date || "", paymentTerms: full.payment_terms },
      lineItems: (full.lineItems || []).map((li) => ({
        catalogItem: li.catalog_item ? apiItemToCatalogItem(li.catalog_item) : ({} as CatalogItem),
        quantity: li.quantity,
      })),
      supplier: full.supplier,
      totalAmount: Number(full.total_amount),
      currentStatus: full.current_status as POStatus,
      statusHistory: (full.statusHistory || []).map((sh) => ({
        status: sh.status as POStatus,
        timestamp: sh.transitioned_at,
        note: sh.note || undefined,
      })),
      createdAt: full.created_at,
    };

    setDraft(defaultDraft);
    return po;
  }, [draft.poId, draft.header]);

  const clearDraft = useCallback(() => setDraft(defaultDraft), []);

  return (
    <POContext.Provider
      value={{ draft, addItem, removeItem, updateQuantity, setHeader, submitOrder: submitOrderFn, clearDraft, getDraftTotal, isLoading }}
    >
      {children}
    </POContext.Provider>
  );
};
