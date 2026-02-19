import { CatalogItem } from "@/types/po";
import { usePOContext } from "@/context/PODraftContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Props {
  item: CatalogItem;
}

export default function CatalogCard({ item }: Props) {
  const { addItem, draft } = usePOContext();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const inDraft = draft.lineItems.some((li) => li.catalogItem.id === item.id);
  const supplierMismatch = draft.supplier !== null && draft.supplier !== item.supplier;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const result = await addItem(item);
      if (!result.success) {
        toast({ variant: "destructive", title: "Supplier Mismatch", description: result.error });
      } else {
        toast({ title: "Added to Draft", description: `${item.name} added to PO draft.` });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="group rounded-lg border bg-card p-4 flex flex-col gap-3 animate-slide-in hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{item.id}</p>
          <h3 className="font-semibold text-sm leading-tight mt-0.5">{item.name}</h3>
        </div>
        {item.inStock ? (
          <Badge variant="outline" className="shrink-0 border-success text-success gap-1">
            <CheckCircle2 className="h-3 w-3" /> In Stock
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 border-destructive text-destructive gap-1">
            <XCircle className="h-3 w-3" /> Out of Stock
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Supplier</span>
        <span className="font-medium text-right">{item.supplier}</span>
        <span className="text-muted-foreground">Manufacturer</span>
        <span className="font-medium text-right">{item.manufacturer}</span>
        <span className="text-muted-foreground">Model</span>
        <span className="font-mono text-right">{item.model}</span>
        <span className="text-muted-foreground">Category</span>
        <span className="text-right">{item.category}</span>
      </div>
      <div className="flex items-end justify-between mt-auto pt-2 border-t">
        <div>
          <p className="text-lg font-bold">${item.priceUsd.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {item.leadTimeDays} days lead time
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={inDraft || adding}
          variant={supplierMismatch ? "outline" : "default"}
          className={supplierMismatch ? "border-destructive text-destructive" : ""}
        >
          {adding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              {inDraft ? "In Draft" : "Add"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
