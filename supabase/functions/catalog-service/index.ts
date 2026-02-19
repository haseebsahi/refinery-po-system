import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/catalog-service\/?/, "/");

  try {
    // GET /items — search, filter, sort, paginate
    if (req.method === "GET" && (path === "/" || path === "/items")) {
      const q = url.searchParams.get("q") || "";
      const category = url.searchParams.get("category") || "";
      const supplier = url.searchParams.get("supplier") || "";
      const inStock = url.searchParams.get("inStock");
      const sort = url.searchParams.get("sort") || "price-asc";
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
      const offset = (page - 1) * limit;

      let query = supabase
        .from("catalog_items")
        .select("id, name, category, supplier, manufacturer, model, description, price_usd, lead_time_days, in_stock, specs, compatible_with", { count: "exact" });

      // Text search
      if (q) {
        query = query.or(
          `name.ilike.%${q}%,id.ilike.%${q}%,supplier.ilike.%${q}%,manufacturer.ilike.%${q}%,model.ilike.%${q}%`
        );
      }

      if (category) query = query.eq("category", category);
      if (supplier) query = query.eq("supplier", supplier);
      if (inStock === "true") query = query.eq("in_stock", true);
      if (inStock === "false") query = query.eq("in_stock", false);

      // Sort
      const sortMap: Record<string, { col: string; asc: boolean }> = {
        "price-asc": { col: "price_usd", asc: true },
        "price-desc": { col: "price_usd", asc: false },
        "lead-asc": { col: "lead_time_days", asc: true },
        "lead-desc": { col: "lead_time_days", asc: false },
        "supplier-az": { col: "supplier", asc: true },
      };
      const s = sortMap[sort] || sortMap["price-asc"];
      query = query.order(s.col, { ascending: s.asc });

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);

      return json({
        items: data,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // GET /items/:id — single item detail
    if (req.method === "GET" && path.startsWith("/items/")) {
      const itemId = decodeURIComponent(path.replace("/items/", ""));
      const { data, error } = await supabase
        .from("catalog_items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (error || !data) return json({ error: "Item not found" }, 404);
      return json(data);
    }

    // GET /categories — distinct categories
    if (req.method === "GET" && path === "/categories") {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("category")
        .order("category");

      if (error) return json({ error: error.message }, 500);
      const categories = [...new Set(data?.map((d) => d.category))];
      return json({ categories });
    }

    // GET /suppliers — distinct suppliers
    if (req.method === "GET" && path === "/suppliers") {
      const { data, error } = await supabase
        .from("catalog_items")
        .select("supplier")
        .order("supplier");

      if (error) return json({ error: error.message }, 500);
      const suppliers = [...new Set(data?.map((d) => d.supplier))];
      return json({ suppliers });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
