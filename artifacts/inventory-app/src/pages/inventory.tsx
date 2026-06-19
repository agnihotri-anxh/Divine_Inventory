import { useState } from "react";
import { useListInventory, useListMovements, useCreateMovement, useListWarehouses, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const MOVEMENT_TYPES = ["INWARD", "SALE", "DISPATCH", "TRANSFER_IN", "TRANSFER_OUT", "DAMAGE", "EXPIRED", "ADJUSTMENT"];
const MOVEMENT_COLORS: Record<string, string> = {
  INWARD: "bg-emerald-100 text-emerald-700", SALE: "bg-blue-100 text-blue-700",
  RETURN: "bg-amber-100 text-amber-700", DISPATCH: "bg-violet-100 text-violet-700",
  DAMAGE: "bg-red-100 text-red-700", EXPIRED: "bg-red-100 text-red-700",
  ADJUSTMENT: "bg-gray-100 text-gray-700", TRANSFER_IN: "bg-cyan-100 text-cyan-700",
  TRANSFER_OUT: "bg-orange-100 text-orange-700",
};

function MovementForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateMovement();
  const { data: warehouses } = useListWarehouses();
  const { data: products } = useListProducts({ limit: 200 });
  const [form, setForm] = useState({
    product_id: "", warehouse_id: "", movement_type: "INWARD", qty: 1,
    reference_type: "", reference_id: "", created_by: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id || !form.warehouse_id) {
      toast({ title: "Select product and warehouse", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        body: {
          movement_id: crypto.randomUUID(),
          product_id: +form.product_id,
          warehouse_id: +form.warehouse_id,
          movement_type: form.movement_type,
          qty: form.qty,
          reference_type: form.reference_type || undefined,
          reference_id: form.reference_id || undefined,
          created_by: form.created_by || undefined,
        }
      });
      toast({ title: "Movement recorded" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to record movement", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
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
          <Label>Movement Type *</Label>
          <select value={form.movement_type} onChange={e => setForm(f => ({ ...f, movement_type: e.target.value }))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
            {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label>Quantity *</Label>
          <Input type="number" min={1} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: +e.target.value }))} required />
        </div>
        <div>
          <Label>Reference Type</Label>
          <Input value={form.reference_type} onChange={e => setForm(f => ({ ...f, reference_type: e.target.value }))} placeholder="e.g. PO, GRN" />
        </div>
        <div>
          <Label>Reference ID</Label>
          <Input value={form.reference_id} onChange={e => setForm(f => ({ ...f, reference_id: e.target.value }))} placeholder="e.g. PO-1234" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Recording..." : "Record Movement"}
      </Button>
    </form>
  );
}

export default function Inventory() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: inventory, isLoading: invLoading, refetch: refetchInv } = useListInventory({ limit: 100 });
  const { data: movements, isLoading: movLoading, refetch: refetchMov } = useListMovements({ limit: 50 });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Record Movement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
            <MovementForm onSuccess={() => { setDialogOpen(false); refetchInv(); refetchMov(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">Current Stock</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="balance" className="mt-4">
          <Card className="border border-card-border">
            <CardContent className="p-0">
              {invLoading ? (
                <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !inventory?.data?.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">No inventory yet. Record an inward movement to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["SKU", "Product", "Warehouse", "Available", "Reserved", "Damaged", "Expired", "Returned"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.data.map((b: any) => (
                        <tr key={b.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{b.product?.sku_code}</td>
                          <td className="px-4 py-3 font-medium">{b.product?.product_name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{b.warehouse?.warehouse_name}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{b.available_qty}</td>
                          <td className="px-4 py-3 text-amber-600">{b.reserved_qty}</td>
                          <td className="px-4 py-3 text-red-600">{b.damaged_qty}</td>
                          <td className="px-4 py-3 text-red-500">{b.expired_qty}</td>
                          <td className="px-4 py-3 text-blue-600">{b.returned_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card className="border border-card-border">
            <CardContent className="p-0">
              {movLoading ? (
                <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !movements?.data?.length ? (
                <div className="text-center py-16 text-muted-foreground text-sm">No movements recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Type", "Product", "Warehouse", "Qty", "Ref", "By", "When"].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {movements.data.map((m: any) => (
                        <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MOVEMENT_COLORS[m.movement_type] ?? "bg-gray-100 text-gray-700"}`}>{m.movement_type}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[140px] truncate">{m.product?.product_name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{m.warehouse?.warehouse_name}</td>
                          <td className="px-4 py-3 font-semibold">{m.qty}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{m.reference_id || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{m.created_by || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
