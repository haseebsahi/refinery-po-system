import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchOrder, updatePOStatus, CatalogApiItem } from "@/lib/api";
import { POStatus, CatalogItem } from "@/types/po";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, CheckCircle2, XCircle, Truck, Clock, FileText, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const statusIcon: Record<POStatus, React.ReactNode> = {
  Draft: <FileText className="h-4 w-4" />,
  Submitted: <Clock className="h-4 w-4" />,
  Approved: <CheckCircle2 className="h-4 w-4" />,
  Rejected: <XCircle className="h-4 w-4" />,
  Fulfilled: <Truck className="h-4 w-4" />,
};

const statusColor: Record<POStatus, string> = {
  Draft: "text-muted-foreground border-muted",
  Submitted: "text-info border-info",
  Approved: "text-success border-success",
  Rejected: "text-destructive border-destructive",
  Fulfilled: "text-accent border-accent",
};

const transitions: Record<POStatus, POStatus[]> = {
  Draft: ["Submitted"],
  Submitted: ["Approved", "Rejected"],
  Approved: ["Fulfilled"],
  Rejected: [],
  Fulfilled: [],
};

function toFrontendItem(ci: CatalogApiItem): CatalogItem {
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
  };
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState<POStatus | "">("");
  const [updating, setUpdating] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground">Order not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/orders")}>Back to Orders</Button>
      </div>
    );
  }

  const currentStatus = order.current_status as POStatus;
  const possibleTransitions = transitions[currentStatus] || [];
  const lineItems = order.lineItems || [];
  const statusHistory = order.statusHistory || [];

  const handleStatusUpdate = async () => {
    if (!nextStatus) return;
    setUpdating(true);
    try {
      await updatePOStatus(order.id, nextStatus);
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setNextStatus("");
      toast({ title: "Status Updated", description: `PO status changed to ${nextStatus}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{order.po_number}</h1>
          <p className="text-muted-foreground text-sm">{order.supplier}</p>
        </div>
        <Badge className={`text-sm px-3 py-1 ${statusColor[currentStatus]} border`} variant="outline">
          {statusIcon[currentStatus]}
          <span className="ml-1.5">{currentStatus}</span>
        </Badge>
      </div>

      {/* Status Timeline */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Status Timeline</h3>
        <div className="relative">
          {statusHistory.map((entry, i) => (
            <div key={i} className="flex gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 ${statusColor[entry.status as POStatus]} bg-card`} />
                {i < statusHistory.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="pb-2">
                <p className="text-sm font-semibold">{entry.status}</p>
                <p className="text-xs text-muted-foreground">{new Date(entry.transitioned_at).toLocaleString()}</p>
                {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transition controls */}
      {possibleTransitions.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/30">
          <span className="text-sm font-medium">Update Status:</span>
          <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as POStatus)}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {possibleTransitions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!nextStatus || updating} onClick={handleStatusUpdate}>
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </Button>
        </div>
      )}

      {/* Header info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">PO Header</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Requestor</dt>
            <dd className="font-medium">{order.requestor}</dd>
            <dt className="text-muted-foreground">Cost Center</dt>
            <dd className="font-mono">{order.cost_center}</dd>
            <dt className="text-muted-foreground">Needed By</dt>
            <dd>{order.needed_by_date || "—"}</dd>
            <dt className="text-muted-foreground">Payment Terms</dt>
            <dd>{order.payment_terms}</dd>
          </dl>
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Summary</h3>
          <p className="text-sm text-muted-foreground">{lineItems.length} line item(s)</p>
          <p className="text-2xl font-bold font-mono">${Number(order.total_amount).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Created {new Date(order.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Item</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((li) => {
              const ci = li.catalog_item ? toFrontendItem(li.catalog_item) : null;
              return (
                <TableRow key={li.id}>
                  <TableCell>
                    <p className="font-medium text-sm">{ci?.name ?? li.catalog_item_id}</p>
                    <p className="text-xs text-muted-foreground font-mono">{li.catalog_item_id}</p>
                  </TableCell>
                  <TableCell className="text-center font-mono">{li.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-sm">${Number(li.unit_price).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${Number(li.unit_price * li.quantity).toLocaleString()}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
