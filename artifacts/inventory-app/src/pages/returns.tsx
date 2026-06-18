import { useState } from "react";
import { useListReturns, useCreateReturn, useUpdateReturnQc, useListWarehouses, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const QC_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  GOOD: "bg-emerald-100 text-emerald-700",
  DAMAGED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-700",
};

function ReturnForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateReturn();
  const { data: warehouses } = useListWarehouses();
  const { data: products } = useListProducts({ limit: 200 });
  const [form, setForm] = useState({ product_id: "", warehouse_id: "", qty: 1, return_reason: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.warehouse_id) {
      toast({ title: "Select product and warehouse", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({ body: { product_id: +form.product_id, warehouse_id: +form.warehouse_id, qty: form.qty, return_reason: form.return_reason || undefined } });
      toast({ title: "Return created" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create return", variant: "destructive" });
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
        <Label>Quantity</Label>
        <Input type="number" min={1} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: +e.target.value }))} />
      </div>
      <div>
        <Label>Return Reason</Label>
        <Input value={form.return_reason} onChange={e => setForm(f => ({ ...f, return_reason: e.target.value }))} placeholder="Reason for return" />
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Submitting..." : "Submit Return"}
      </Button>
    </form>
  );
}

function QcButtons({ ret, onDone }: { ret: any; onDone: () => void }) {
  const { toast } = useToast();
  const update = useUpdateReturnQc();

  if (ret.qc_status !== "PENDING") return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${QC_COLORS[ret.qc_status]}`}>{ret.qc_status}</span>
  );

  const handle = async (qcStatus: string) => {
    try {
      await update.mutateAsync({ id: ret.id, body: { qc_status: qcStatus } });
      toast({ title: `QC marked as ${qcStatus}` });
      onDone();
    } catch {
      toast({ title: "Failed to update QC", variant: "destructive" });
    }
  };

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="outline" className="h-6 text-xs text-emerald-700 border-emerald-200" onClick={() => handle("GOOD")}>Good</Button>
      <Button size="sm" variant="outline" className="h-6 text-xs text-red-700 border-red-200" onClick={() => handle("DAMAGED")}>Damaged</Button>
      <Button size="sm" variant="outline" className="h-6 text-xs text-gray-700 border-gray-200" onClick={() => handle("EXPIRED")}>Expired</Button>
    </div>
  );
}

export default function Returns() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, refetch } = useListReturns({ limit: 100 });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Return</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Return</DialogTitle></DialogHeader>
            <ReturnForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No returns yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Return No.", "Product", "Warehouse", "Qty", "Reason", "QC Status", "When"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.return_number}</td>
                      <td className="px-4 py-3">{r.product?.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{r.warehouse?.warehouse_name}</td>
                      <td className="px-4 py-3 font-semibold">{r.qty}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{r.return_reason || "—"}</td>
                      <td className="px-4 py-3"><QcButtons ret={r} onDone={refetch} /></td>
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
