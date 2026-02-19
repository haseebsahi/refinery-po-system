import { useQuery } from "@tanstack/react-query";
import { fetchCatalog, CatalogApiItem } from "@/lib/api";
import { CatalogItem } from "@/types/po";

function toCatalogItem(item: CatalogApiItem): CatalogItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    supplier: item.supplier,
    manufacturer: item.manufacturer,
    model: item.model,
    priceUsd: Number(item.price_usd),
    leadTimeDays: item.lead_time_days,
    inStock: item.in_stock,
    description: item.description,
    specs: item.specs as Record<string, string> | undefined,
    compatibleWith: item.compatible_with ?? undefined,
  };
}

interface UseCatalogParams {
  search?: string;
  category?: string;
  inStock?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export function useCatalog({ search, category, inStock, sort, page = 1, limit = 50 }: UseCatalogParams) {
  return useQuery({
    queryKey: ["catalog", { search, category, inStock, sort, page, limit }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (category) params.category = category;
      if (inStock) params.inStock = "true";
      if (sort) params.sort = sort;
      params.page = String(page);
      params.limit = String(limit);

      const res = await fetchCatalog(params);
      return {
        items: res.items.map(toCatalogItem),
        pagination: res.pagination,
      };
    },
    staleTime: 30_000,
  });
}
