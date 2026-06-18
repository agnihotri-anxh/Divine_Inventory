import { useState } from "react";
import { useListOrders, useCreateOrder, useListWarehouses, useListProducts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-700",
  DISPATCHED: "bg-violet-100 text-violet-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function OrderForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateOrder();
  const { data: warehouses } = useListWarehouses();
  const { data: products } = useListProducts({ limit: 200 });
  const [channel, setChannel] = useState("MANUAL");
  const [items, setItems] = useState([{ product_id: "", warehouse_id: "", qty: 1 }]);

  const addItem = () => setItems(i => [...i, { product_id: "", warehouse_id: "", qty: 1 }]);
  const removeItem = (idx: number) => setItems(i => i.filter((_, j) => j !== idx));
  const updateItem = (idx: number, key: string, val: any) =>
    setItems(i => i.map((item, j) => j === idx ? { ...item, [key]: val } : item));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.product_id || !i.warehouse_id)) {
      toast({ title: "Fill all item fields", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        body: {
          channel,
          items: items.map(i => ({ product_id: +i.product_id, warehouse_id: +i.warehouse_id, qty: i.qty }))
        }
      });
      toast({ title: "Order created successfully" });
      onSuccess();
    } catch (err: any) {
      toast({ title: err?.message || "Failed to create order", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Channel</Label>
        <select value={channel} onChange={e => setChannel(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
          {["MANUAL", "ONLINE", "B2B", "WHOLESALE"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Order Items</Label>
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              <select value={item.product_id} onChange={e => updateItem(idx, "product_id", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="">Product</option>
                {(products?.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.sku_code}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <select value={item.warehouse_id} onChange={e => updateItem(idx, "warehouse_id", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="">Warehouse</option>
                {(Array.isArray(warehouses) ? warehouses : []).map((w: any) => <option key={w.id} value={w.id}>{w.warehouse_name}</option>)}
              </select>
            </div>
            <Input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, "qty", +e.target.value)} className="w-20" />
            {items.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" />Add Item</Button>
      </div>

      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Creating..." : "Create Order"}
      </Button>
    </form>
  );
}

export default function Orders() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, refetch } = useListOrders({ limit: 100 });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Order</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
            <OrderForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No orders yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Order No.", "Channel", "Items", "Status", "Created"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((o: any) => (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{o.order_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.channel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.items?.length ?? 0} item(s)</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
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
