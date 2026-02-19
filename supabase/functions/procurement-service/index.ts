import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Validation helpers ──

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(["Approved", "Rejected", "Fulfilled"]);

function isUUID(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function isNonEmptyString(v: unknown, maxLen = 255): v is string {
  return (
    typeof v === "string" && v.trim().length > 0 && v.trim().length <= maxLen
  );
}

function isOptionalString(v: unknown, maxLen = 255): boolean {
  return (
    v === undefined ||
    v === null ||
    (typeof v === "string" && v.length <= maxLen)
  );
}

function isPositiveInt(v: unknown, max = 10000): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= max;
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = parseInt(raw || String(fallback), 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeParseBody(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/procurement-service\/?/, "/");

  try {
    // ============================================================
    // POST /orders — Create a new draft PO
    // ============================================================
    if (req.method === "POST" && (path === "/" || path === "/orders")) {
      const body = await req.json().catch(() => null);
      if (!safeParseBody(body))
        return json({ error: "Invalid request body" }, 400);

      const { supplier, requestor, costCenter, neededByDate, paymentTerms } =
        body;

      if (!isNonEmptyString(supplier))
        return json({ error: "supplier is required (max 255 chars)" }, 400);
      if (requestor !== undefined && !isOptionalString(requestor, 255))
        return json({ error: "requestor must be <= 255 chars" }, 400);
      if (!isOptionalString(costCenter, 100))
        return json({ error: "costCenter must be <= 100 chars" }, 400);
      if (neededByDate !== undefined && neededByDate !== null) {
        if (typeof neededByDate !== "string" || !DATE_RE.test(neededByDate)) {
          return json({ error: "neededByDate must be YYYY-MM-DD format" }, 400);
        }
      }
      if (!isOptionalString(paymentTerms, 50))
        return json({ error: "paymentTerms must be <= 50 chars" }, 400);

      // Idempotency check
      const idempotencyKey = req.headers.get("x-idempotency-key");
      if (idempotencyKey && !UUID_RE.test(idempotencyKey)) {
        return json({ error: "x-idempotency-key must be a valid UUID" }, 400);
      }

      if (idempotencyKey) {
        const { data: existing } = await supabase
          .from("purchase_orders")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) return json(existing, 200);
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .insert({
          supplier: (supplier as string).trim(),
          requestor: (requestor as string).trim(),
          cost_center: typeof costCenter === "string" ? costCenter.trim() : "",
          needed_by_date: neededByDate || null,
          payment_terms:
            typeof paymentTerms === "string" ? paymentTerms.trim() : "Net 30",
          idempotency_key: idempotencyKey || null,
        })
        .select()
        .single();

      if (error) return json({ error: "Failed to create purchase order" }, 500);
      return json(data, 201);
    }

    // ============================================================
    // GET /orders — List POs with optional filters
    // ============================================================
    if (req.method === "GET" && (path === "/" || path === "/orders")) {
      const status = url.searchParams.get("status");
      const supplier = url.searchParams.get("supplier");
      const page = clampInt(url.searchParams.get("page"), 1, 1, 1000);
      const limit = clampInt(url.searchParams.get("limit"), 20, 1, 100);
      const offset = (page - 1) * limit;

      let query = supabase
        .from("purchase_orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (status) {
        const validStatuses = [
          "Draft",
          "Submitted",
          "Approved",
          "Rejected",
          "Fulfilled",
        ];
        if (!validStatuses.includes(status))
          return json({ error: "Invalid status filter" }, 400);
        query = query.eq("current_status", status);
      }
      if (supplier) {
        if (supplier.length > 255)
          return json({ error: "supplier filter too long" }, 400);
        query = query.eq("supplier", supplier);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) return json({ error: "Failed to fetch orders" }, 500);

      return json({
        orders: data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // ============================================================
    // PATCH /orders/:id — Update draft PO header fields
    // ============================================================
    const orderMatch = path.match(/^\/orders\/([^/]+)$/);
    if (req.method === "PATCH" && orderMatch) {
      const poId = orderMatch[1];
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);

      const body = await req.json().catch(() => null);
      if (!safeParseBody(body))
        return json({ error: "Invalid request body" }, 400);

      const { requestor, costCenter, neededByDate, paymentTerms } = body;

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("current_status")
        .eq("id", poId)
        .single();
      if (!po) return json({ error: "PO not found" }, 404);
      if (po.current_status !== "Draft")
        return json({ error: "Can only update Draft POs" }, 422);

      const updates: Record<string, unknown> = {};
      if (requestor !== undefined) {
        if (!isNonEmptyString(requestor))
          return json({ error: "requestor must be non-empty (max 255)" }, 400);
        updates.requestor = (requestor as string).trim();
      }
      if (costCenter !== undefined) {
        if (!isOptionalString(costCenter, 100))
          return json({ error: "costCenter must be <= 100 chars" }, 400);
        updates.cost_center =
          typeof costCenter === "string" ? costCenter.trim() : "";
      }
      if (neededByDate !== undefined) {
        if (
          neededByDate !== null &&
          (typeof neededByDate !== "string" || !DATE_RE.test(neededByDate))
        ) {
          return json(
            { error: "neededByDate must be YYYY-MM-DD or null" },
            400,
          );
        }
        updates.needed_by_date = neededByDate || null;
      }
      if (paymentTerms !== undefined) {
        if (!isOptionalString(paymentTerms, 50))
          return json({ error: "paymentTerms must be <= 50 chars" }, 400);
        updates.payment_terms =
          typeof paymentTerms === "string" ? paymentTerms.trim() : "Net 30";
      }

      if (Object.keys(updates).length === 0)
        return json({ error: "No fields to update" }, 400);

      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", poId)
        .select()
        .single();

      if (error) return json({ error: "Failed to update purchase order" }, 500);
      return json(data);
    }

    // ============================================================
    // GET /orders/:id — Single PO with line items + status history
    // ============================================================
    if (req.method === "GET" && orderMatch) {
      const poId = orderMatch[1];
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);

      const [poRes, linesRes, historyRes] = await Promise.all([
        supabase.from("purchase_orders").select("*").eq("id", poId).single(),
        supabase
          .from("po_line_items")
          .select("*, catalog_item:catalog_items(*)")
          .eq("po_id", poId)
          .order("created_at"),
        supabase
          .from("po_status_history")
          .select("*")
          .eq("po_id", poId)
          .order("transitioned_at"),
      ]);

      if (poRes.error || !poRes.data)
        return json({ error: "PO not found" }, 404);

      return json({
        ...poRes.data,
        lineItems: linesRes.data || [],
        statusHistory: historyRes.data || [],
      });
    }

    // ============================================================
    // POST /orders/:id/lines — Add line item to draft PO
    // ============================================================
    const addLineMatch = path.match(/^\/orders\/([^/]+)\/lines$/);
    if (req.method === "POST" && addLineMatch) {
      const poId = addLineMatch[1];
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);

      const body = await req.json().catch(() => null);
      if (!safeParseBody(body))
        return json({ error: "Invalid request body" }, 400);

      const { catalogItemId, quantity } = body;

      if (!isNonEmptyString(catalogItemId, 100))
        return json(
          { error: "catalogItemId is required (max 100 chars)" },
          400,
        );
      if (!isPositiveInt(quantity))
        return json(
          { error: "quantity must be an integer between 1 and 10000" },
          400,
        );

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("current_status, supplier")
        .eq("id", poId)
        .single();

      if (!po) return json({ error: "PO not found" }, 404);
      if (po.current_status !== "Draft")
        return json({ error: "Can only add lines to Draft POs" }, 422);

      const { data: item } = await supabase
        .from("catalog_items")
        .select("supplier, price_usd")
        .eq("id", catalogItemId)
        .single();

      if (!item) return json({ error: "Catalog item not found" }, 404);

      if (item.supplier !== po.supplier) {
        return json(
          {
            error: "Supplier mismatch",
            detail: `PO is locked to "${po.supplier}" but item belongs to "${item.supplier}"`,
          },
          409,
        );
      }

      // Upsert line item
      const { data: existingLine } = await supabase
        .from("po_line_items")
        .select("id, quantity")
        .eq("po_id", poId)
        .eq("catalog_item_id", catalogItemId)
        .maybeSingle();

      let result;
      if (existingLine) {
        const newQty = existingLine.quantity + (quantity as number);
        if (newQty > 10000)
          return json({ error: "Total quantity cannot exceed 10000" }, 400);
        result = await supabase
          .from("po_line_items")
          .update({ quantity: newQty })
          .eq("id", existingLine.id)
          .select("*, catalog_item:catalog_items(*)")
          .single();
      } else {
        result = await supabase
          .from("po_line_items")
          .insert({
            po_id: poId,
            catalog_item_id: catalogItemId as string,
            quantity: quantity as number,
            unit_price: item.price_usd,
          })
          .select("*, catalog_item:catalog_items(*)")
          .single();
      }

      if (result.error) return json({ error: "Failed to add line item" }, 500);
      return json(result.data, 201);
    }

    // ============================================================
    // PATCH /orders/:id/lines/:lineId — Update line item quantity
    // ============================================================
    const updateLineMatch = path.match(/^\/orders\/([^/]+)\/lines\/([^/]+)$/);
    if (req.method === "PATCH" && updateLineMatch) {
      const [, poId, lineId] = updateLineMatch;
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);
      if (!isUUID(lineId)) return json({ error: "Invalid line item ID" }, 400);

      const body = await req.json().catch(() => null);
      if (!safeParseBody(body))
        return json({ error: "Invalid request body" }, 400);

      const { quantity } = body;
      if (!isPositiveInt(quantity))
        return json(
          { error: "quantity must be an integer between 1 and 10000" },
          400,
        );

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("current_status")
        .eq("id", poId)
        .single();
      if (!po) return json({ error: "PO not found" }, 404);
      if (po.current_status !== "Draft")
        return json({ error: "Can only modify Draft POs" }, 422);

      const { data, error } = await supabase
        .from("po_line_items")
        .update({ quantity: quantity as number })
        .eq("id", lineId)
        .eq("po_id", poId)
        .select("*, catalog_item:catalog_items(*)")
        .single();

      if (error || !data) return json({ error: "Line item not found" }, 404);
      return json(data);
    }

    // ============================================================
    // DELETE /orders/:id/lines/:lineId — Remove line item
    // ============================================================
    if (req.method === "DELETE" && updateLineMatch) {
      const [, poId, lineId] = updateLineMatch;
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);
      if (!isUUID(lineId)) return json({ error: "Invalid line item ID" }, 400);

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("current_status")
        .eq("id", poId)
        .single();
      if (!po) return json({ error: "PO not found" }, 404);
      if (po.current_status !== "Draft")
        return json({ error: "Can only modify Draft POs" }, 422);

      const { error } = await supabase
        .from("po_line_items")
        .delete()
        .eq("id", lineId)
        .eq("po_id", poId);
      if (error) return json({ error: "Failed to delete line item" }, 500);

      return json({ success: true }, 200);
    }

    // ============================================================
    // POST /orders/:id/submit — Submit draft PO
    // ============================================================
    const submitMatch = path.match(/^\/orders\/([^/]+)\/submit$/);
    if (req.method === "POST" && submitMatch) {
      const poId = submitMatch[1];
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", poId)
        .single();
      if (!po) return json({ error: "PO not found" }, 404);
      if (po.current_status !== "Draft") {
        return json(
          { error: `Cannot submit PO in "${po.current_status}" status` },
          422,
        );
      }

      const { count } = await supabase
        .from("po_line_items")
        .select("id", { count: "exact", head: true })
        .eq("po_id", poId);

      if (!count || count === 0) {
        return json({ error: "Cannot submit PO with no line items" }, 422);
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({ current_status: "Submitted" })
        .eq("id", poId)
        .select()
        .single();

      if (error) return json({ error: "Failed to submit purchase order" }, 500);
      return json(data);
    }

    // ============================================================
    // POST /orders/:id/status — Transition PO status
    // ============================================================
    const statusMatch = path.match(/^\/orders\/([^/]+)\/status$/);
    if (req.method === "POST" && statusMatch) {
      const poId = statusMatch[1];
      if (!isUUID(poId)) return json({ error: "Invalid PO ID" }, 400);

      const body = await req.json().catch(() => null);
      if (!safeParseBody(body))
        return json({ error: "Invalid request body" }, 400);

      const { status, note } = body;

      if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
        return json(
          { error: `status must be one of: ${[...VALID_STATUSES].join(", ")}` },
          400,
        );
      }
      if (
        note !== undefined &&
        (typeof note !== "string" || note.length > 1000)
      ) {
        return json({ error: "note must be a string (max 1000 chars)" }, 400);
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({ current_status: status })
        .eq("id", poId)
        .select()
        .single();

      if (error) {
        if (error.message.includes("Invalid status transition")) {
          return json({ error: error.message }, 422);
        }
        return json({ error: "Failed to update status" }, 500);
      }

      if (note) {
        await supabase
          .from("po_status_history")
          .update({ note: (note as string).trim() })
          .eq("po_id", poId)
          .eq("status", status)
          .order("transitioned_at", { ascending: false })
          .limit(1);
      }

      return json(data);
    }

    return json({ error: "Not found" }, 404);
  } catch (_err) {
    return json({ error: "Internal server error" }, 500);
  }
});
