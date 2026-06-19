import { useState } from "react";
import { useListReconciliation, useCreateReconciliation, useApproveReconciliation, useListWarehouses, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, ClipboardCheck, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

function ReconciliationForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateReconciliation();
  const { data: warehouses } = useListWarehouses();
  const { data: products } = useListProducts({ limit: 200 });
  const [form, setForm] = useState({ product_id: "", warehouse_id: "", physical_qty: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.warehouse_id) {
      toast({ title: "Select product and warehouse", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ body: { product_id: +form.product_id, warehouse_id: +form.warehouse_id, physical_qty: form.physical_qty } });
      toast({ title: "Reconciliation submitted" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create reconciliation", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Product *</Label>
        <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
          <option value="">Select product</option>
          {(products?.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.sku_code} – {p.product_name}</option>)}
        </select>
      </div>
      <div>
        <Label>Warehouse *</Label>
        <select value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))} required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
          <option value="">Select warehouse</option>
          {(Array.isArray(warehouses) ? warehouses : []).map((w: any) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
        </select>
      </div>
      <div>
        <Label>Physical Count</Label>
        <Input type="number" min={0} value={form.physical_qty} onChange={e => setForm(f => ({ ...f, physical_qty: +e.target.value }))} />
        <p className="text-xs text-muted-foreground mt-1">Enter the qty you physically counted</p>
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Submitting..." : "Submit Reconciliation"}
      </Button>
    </form>
  );
}

function ApproveButton({ rec, onDone }: { rec: any; onDone: () => void }) {
  const { toast } = useToast();
  const approve = useApproveReconciliation();

  if (rec.status !== "PENDING") return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[rec.status]}`}>{rec.status}</span>
  );

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-6 text-xs text-emerald-700 border-emerald-200"
      onClick={async () => {
        try {
          await approve.mutateAsync({ id: rec.id });
          toast({ title: "Reconciliation approved and stock adjusted" });
          onDone();
        } catch {
          toast({ title: "Failed to approve", variant: "destructive" });
        }
      }}
      disabled={approve.isPending}
    >
      <CheckCircle className="w-3 h-3 mr-1" />Approve
    </Button>
  );
}

export default function Reconciliation() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, refetch } = useListReconciliation({ limit: 100 });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Reconciliation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Stock Reconciliation</DialogTitle></DialogHeader>
            <ReconciliationForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No reconciliations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Product", "Warehouse", "System Qty", "Physical Qty", "Variance", "Status", "When"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.product?.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.warehouse?.warehouse_name}</td>
                      <td className="px-4 py-3 font-semibold">{r.system_qty}</td>
                      <td className="px-4 py-3 font-semibold">{r.physical_qty}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${r.variance > 0 ? "text-emerald-600" : r.variance < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                          {r.variance > 0 ? "+" : ""}{r.variance}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ApproveButton rec={r} onDone={refetch} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
