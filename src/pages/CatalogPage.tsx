import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SortOption, SORT_LABELS, CATEGORIES } from "@/types/po";
import { useCatalog } from "@/hooks/use-catalog";
import CatalogCard from "@/components/CatalogCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export default function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const debouncedSearch = useDebounce(search, 300);

  const category = params.get("category") || "";
  const inStockOnly = params.get("inStock") === "true";
  const sort = (params.get("sort") as SortOption) || "price-asc";

  // Sync URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("q", debouncedSearch);
    if (category) p.set("category", category);
    if (inStockOnly) p.set("inStock", "true");
    if (sort !== "price-asc") p.set("sort", sort);
    setParams(p, { replace: true });
  }, [debouncedSearch, category, inStockOnly, sort, setParams]);

  const { data, isLoading } = useCatalog({
    search: debouncedSearch || undefined,
    category: category || undefined,
    inStock: inStockOnly || undefined,
    sort,
  });

  const filtered = data?.items ?? [];

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipment Catalog</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse and add items to your purchase order draft</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, ID, supplier, manufacturer, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category || "all"} onValueChange={(v) => setFilter("category", v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setFilter("sort", v)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-2">
          <Checkbox
            id="inStock"
            checked={inStockOnly}
            onCheckedChange={(c) => setFilter("inStock", c ? "true" : "")}
          />
          <Label htmlFor="inStock" className="text-sm whitespace-nowrap cursor-pointer">In Stock Only</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No items found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <CatalogCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
