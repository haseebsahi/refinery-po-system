import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchOrders, POApiResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardList, Loader2 } from "lucide-react";
import { POStatus } from "@/types/po";

const statusColor: Record<POStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-info text-info-foreground",
  Approved: "bg-success text-success-foreground",
  Rejected: "bg-destructive text-destructive-foreground",
  Fulfilled: "bg-accent text-accent-foreground",
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders({ limit: "100" }),
  });

  const orders = data?.orders ?? [];

  if (isLoading) {
    return (
      <div className="container py-20 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="container py-20 text-center">
        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
        <p className="text-muted-foreground">Submit a purchase order to see it here.</p>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Purchase Orders</h1>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Requestor</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow
                key={o.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/orders/${o.id}`)}
              >
                <TableCell className="font-mono font-semibold">{o.po_number}</TableCell>
                <TableCell>{o.supplier}</TableCell>
                <TableCell>{o.requestor}</TableCell>
                <TableCell className="text-right font-mono">${Number(o.total_amount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={statusColor[o.current_status as POStatus]}>{o.current_status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(o.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
