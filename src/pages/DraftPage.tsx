import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePOContext } from "@/context/PODraftContext";
import { POHeader, PAYMENT_TERMS } from "@/types/po";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Minus, Plus, ArrowLeft, ArrowRight, Loader2, CheckCircle2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Step = "items" | "header" | "review" | "submitting" | "success";

export default function DraftPage() {
  const { draft, removeItem, updateQuantity, setHeader, submitOrder, clearDraft, getDraftTotal, isLoading } = usePOContext();
  const [step, setStep] = useState<Step>("items");
  const [submittedPO, setSubmittedPO] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [headerForm, setHeaderForm] = useState<POHeader>(
    draft.header || { requestor: "", costCenter: "CC-1234", neededByDate: "", paymentTerms: "Net 30" }
  );

  const total = getDraftTotal();

  if (draft.lineItems.length === 0 && step !== "success") {
    return (
      <div className="container py-20 text-center">
        <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Your draft is empty</h2>
        <p className="text-muted-foreground mb-6">Browse the catalog to add items to your purchase order.</p>
        <Button onClick={() => navigate("/")}>Go to Catalog</Button>
      </div>
    );
  }

  const handleHeaderSubmit = () => {
    if (!headerForm.requestor || !headerForm.neededByDate || !headerForm.costCenter) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all required fields." });
      return;
    }
    setHeader(headerForm);
    setStep("review");
  };

  const handleSubmit = async () => {
    setStep("submitting");
    try {
      const po = await submitOrder();
      setSubmittedPO(po.poNumber);
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch {
      toast({ variant: "destructive", title: "Submission Failed", description: "Please try again." });
      setStep("review");
    }
  };

  if (step === "success") {
    return (
      <div className="container py-20 text-center animate-slide-in">
        <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
        <h2 className="text-2xl font-bold mb-2">Purchase Order Submitted</h2>
        <p className="font-mono text-lg text-accent mb-6">{submittedPO}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate("/")}>New Order</Button>
          <Button onClick={() => navigate("/orders")}>View Orders</Button>
        </div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="container py-20 text-center">
        <Loader2 className="h-12 w-12 mx-auto animate-spin text-accent mb-4" />
        <h2 className="text-xl font-semibold">Submitting Purchase Order...</h2>
        <p className="text-muted-foreground mt-2">Generating PO number and processing</p>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["items", "header", "review"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-border" />}
            <button
              onClick={() => {
                if (s === "items") setStep("items");
                if (s === "header" && step !== "items") setStep("header");
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                step === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {s === "items" ? "Line Items" : s === "header" ? "PO Header" : "Review & Submit"}
            </button>
          </div>
        ))}
      </div>

      {step === "items" && (
        <div className="space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Line Items</h2>
              <p className="text-sm text-muted-foreground">Supplier: <span className="font-semibold text-foreground">{draft.supplier}</span></p>
            </div>
            <Button variant="outline" size="sm" onClick={clearDraft} className="text-destructive border-destructive">
              Clear Draft
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lineItems.map((li) => (
                  <TableRow key={li.catalogItem.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{li.catalogItem.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{li.catalogItem.id} · {li.catalogItem.model}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(li.catalogItem.id, li.quantity - 1)} disabled={li.quantity <= 1 || isLoading}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono text-sm">{li.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(li.catalogItem.id, li.quantity + 1)} disabled={isLoading}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">${li.catalogItem.priceUsd.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">${(li.catalogItem.priceUsd * li.quantity).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(li.catalogItem.id)} disabled={isLoading}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-lg font-bold">Total: <span className="font-mono">${total.toLocaleString()}</span></p>
            <Button onClick={() => setStep("header")} className="gap-1">
              Continue to Header <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "header" && (
        <div className="max-w-lg space-y-6 animate-slide-in">
          <h2 className="text-xl font-bold">PO Header Information</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="requestor">Requestor *</Label>
              <Input id="requestor" value={headerForm.requestor} onChange={(e) => setHeaderForm((p) => ({ ...p, requestor: e.target.value }))} placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="costCenter">Cost Center *</Label>
              <Input id="costCenter" value={headerForm.costCenter} onChange={(e) => setHeaderForm((p) => ({ ...p, costCenter: e.target.value }))} placeholder="CC-1234" />
            </div>
            <div>
              <Label htmlFor="neededBy">Needed-By Date *</Label>
              <Input id="neededBy" type="date" value={headerForm.neededByDate} onChange={(e) => setHeaderForm((p) => ({ ...p, neededByDate: e.target.value }))} />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select value={headerForm.paymentTerms} onValueChange={(v) => setHeaderForm((p) => ({ ...p, paymentTerms: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("items")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={handleHeaderSubmit} className="gap-1">
              Review Order <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-6 animate-slide-in">
          <h2 className="text-xl font-bold">Review Purchase Order</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">PO Header</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Requestor</dt>
                <dd className="font-medium">{draft.header?.requestor}</dd>
                <dt className="text-muted-foreground">Cost Center</dt>
                <dd className="font-mono">{draft.header?.costCenter}</dd>
                <dt className="text-muted-foreground">Needed By</dt>
                <dd>{draft.header?.neededByDate}</dd>
                <dt className="text-muted-foreground">Payment Terms</dt>
                <dd>{draft.header?.paymentTerms}</dd>
              </dl>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setStep("header")}>
                Edit Header
              </Button>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Supplier</h3>
              <p className="text-lg font-semibold">{draft.supplier}</p>
              <p className="text-sm text-muted-foreground">{draft.lineItems.length} line item(s)</p>
              <p className="text-2xl font-bold font-mono mt-2">${total.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lineItems.map((li) => (
                  <TableRow key={li.catalogItem.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{li.catalogItem.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{li.catalogItem.id}</p>
                    </TableCell>
                    <TableCell className="text-center font-mono">{li.quantity}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${(li.catalogItem.priceUsd * li.quantity).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("items")} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Edit Items
            </Button>
            <Button onClick={handleSubmit} className="bg-success hover:bg-success/90 text-success-foreground gap-1">
              Submit Purchase Order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
