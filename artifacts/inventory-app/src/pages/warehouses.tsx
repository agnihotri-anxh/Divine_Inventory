import { useState } from "react";
import { useListWarehouses, useCreateWarehouse } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPE_OPTS = ["MAIN", "TRANSIT", "COLD_STORAGE", "RETURNS"];

function WarehouseForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const create = useCreateWarehouse();
  const [form, setForm] = useState({ warehouse_name: "", location: "", warehouse_type: "MAIN" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({ body: form });
      toast({ title: "Warehouse created" });
      onSuccess();
    } catch {
      toast({ title: "Failed to create warehouse", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Warehouse Name *</Label>
        <Input value={form.warehouse_name} onChange={e => setForm(f => ({ ...f, warehouse_name: e.target.value }))} required placeholder="e.g. Main Delhi Warehouse" />
      </div>
      <div>
        <Label>Location</Label>
        <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, State" />
      </div>
      <div>
        <Label>Type</Label>
        <select
          value={form.warehouse_type}
          onChange={e => setForm(f => ({ ...f, warehouse_type: e.target.value }))}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          {TYPE_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? "Creating..." : "Create Warehouse"}
      </Button>
    </form>
  );
}

export default function Warehouses() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, refetch } = useListWarehouses();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{Array.isArray(data) ? data.length : 0} warehouses configured</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Warehouse</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Warehouse</DialogTitle></DialogHeader>
            <WarehouseForm onSuccess={() => { setDialogOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !Array.isArray(data) || data.length === 0 ? (
        <Card className="border border-card-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <WarehouseIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No warehouses yet. Add your first warehouse.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data as any[]).map((w: any) => (
            <Card key={w.id} className="border border-card-border hover:shadow-md transition-shadow" data-testid={`card-warehouse-detail-${w.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <WarehouseIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold">{w.warehouse_name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{w.location || "—"}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{w.warehouse_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Created {new Date(w.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
