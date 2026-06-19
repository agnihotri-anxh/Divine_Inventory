import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const UNIT_OPTIONS = ["PCS", "KG", "LTR", "BOX", "CASE", "SET", "PAIR"];

function ProductForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateProduct();
  const [form, setForm] = useState({
    sku_code: "", product_name: "", category: "", brand: "", unit: "PCS",
    minimum_stock: 0, reorder_stock: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ body: form });
      toast({ title: "Product created" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create product", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>SKU Code *</Label>
          <Input value={form.sku_code} onChange={e => setForm(f => ({ ...f, sku_code: e.target.value }))} required placeholder="SKU-001" />
        </div>
        <div>
          <Label>Product Name *</Label>
          <Input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} required placeholder="Product name" />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Pooja Items" />
        </div>
        <div>
          <Label>Brand</Label>
          <Input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="Brand name" />
        </div>
        <div>
          <Label>Unit</Label>
          <select
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          >
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <Label>Minimum Stock</Label>
          <Input type="number" min={0} value={form.minimum_stock} onChange={e => setForm(f => ({ ...f, minimum_stock: +e.target.value }))} />
        </div>
        <div>
          <Label>Reorder Point</Label>
          <Input type="number" min={0} value={form.reorder_stock} onChange={e => setForm(f => ({ ...f, reorder_stock: +e.target.value }))} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Creating..." : "Create Product"}
      </Button>
    </form>
  );
}

export default function Products() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, refetch } = useListProducts({ search: search || undefined, page: 1, limit: 100 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
            <ProductForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No products found. Add your first product.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["SKU", "Name", "Category", "Brand", "Unit", "Min Stock", "Reorder", "Status"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-product-${p.id}`}>
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{p.sku_code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{p.product_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.brand || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.minimum_stock}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.reorder_stock}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
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
