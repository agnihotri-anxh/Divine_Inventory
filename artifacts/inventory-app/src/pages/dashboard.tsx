import { useGetDashboardSummary, useGetLowStockItems, useGetRecentActivity, useGetWarehouseBreakdown } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, Warehouse, AlertTriangle, ShoppingCart, RotateCcw,
  ClipboardCheck, Bell, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const MOVEMENT_COLORS: Record<string, string> = {
  INWARD: "bg-emerald-100 text-emerald-700",
  SALE: "bg-blue-100 text-blue-700",
  RETURN: "bg-amber-100 text-amber-700",
  DISPATCH: "bg-violet-100 text-violet-700",
  DAMAGE: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
  ADJUSTMENT: "bg-gray-100 text-gray-700",
  TRANSFER_IN: "bg-cyan-100 text-cyan-700",
  TRANSFER_OUT: "bg-orange-100 text-orange-700",
};

function MetricCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | undefined; icon: any; color: string; sub?: string }) {
  return (
    <Card className="hover-elevate border border-card-border" data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            {value === undefined ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p className="text-3xl font-bold text-foreground mt-1">{value.toLocaleString()}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: lowStock, isLoading: lowStockLoading } = useGetLowStockItems();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 15 });
  const { data: breakdown, isLoading: breakdownLoading } = useGetWarehouseBreakdown();

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total SKUs" value={summary?.totalSkus} icon={Package} color="bg-primary/10 text-primary" />
        <MetricCard label="Available Units" value={summary?.totalAvailableUnits} icon={TrendingUp} color="bg-emerald-100 text-emerald-700" />
        <MetricCard label="Low Stock" value={summary?.lowStockCount} icon={AlertTriangle} color="bg-amber-100 text-amber-700" sub="Below minimum" />
        <MetricCard label="Active Alerts" value={summary?.activeAlerts} icon={Bell} color="bg-red-100 text-red-700" />
        <MetricCard label="Pending Dispatches" value={summary?.pendingDispatches} icon={ShoppingCart} color="bg-violet-100 text-violet-700" />
        <MetricCard label="Today's Returns" value={summary?.todayReturns} icon={RotateCcw} color="bg-blue-100 text-blue-700" />
        <MetricCard label="Pending QC" value={summary?.pendingQcCount} icon={RefreshCw} color="bg-orange-100 text-orange-700" />
        <MetricCard label="Pending Recon." value={summary?.pendingReconciliations} icon={ClipboardCheck} color="bg-cyan-100 text-cyan-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2">
          <Card className="border border-card-border h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Low Stock Alerts
                </CardTitle>
                {lowStock && <Badge variant="secondary">{lowStock.length} items</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lowStockLoading ? (
                <div className="space-y-2 px-5 pb-4">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !lowStock?.length ? (
                <div className="text-center py-10 text-muted-foreground text-sm">All stock levels are healthy</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">SKU</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Warehouse</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Avail.</th>
                        <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">Min.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((item, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-low-stock-${i}`}>
                          <td className="px-5 py-2.5 font-mono text-xs text-primary font-medium">{item.skuCode}</td>
                          <td className="px-3 py-2.5 text-foreground">{item.productName}</td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.warehouseName}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="font-semibold text-red-600">{item.availableQty}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right text-muted-foreground">{item.minimumStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Warehouse Breakdown */}
        <div>
          <Card className="border border-card-border h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-primary" />
                Warehouse Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {breakdownLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !breakdown?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No warehouses found</p>
              ) : (
                breakdown.map((wh) => (
                  <div key={wh.warehouseId} className="rounded-lg border border-border p-3 space-y-1.5" data-testid={`card-warehouse-${wh.warehouseId}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{wh.warehouseName}</p>
                      <Badge variant="outline" className="text-[10px]">{wh.warehouseType}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-semibold text-emerald-600">{wh.totalAvailable}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reserved</p>
                        <p className="font-semibold text-amber-600">{wh.totalReserved}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Damaged</p>
                        <p className="font-semibold text-red-600">{wh.totalDamaged}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{wh.skuCount} SKUs tracked</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent Stock Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activityLoading ? (
            <div className="space-y-2 px-5 pb-4">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !activity?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No recent activity</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Product</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Warehouse</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-muted-foreground">Ref</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-muted-foreground">When</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-activity-${m.id}`}>
                      <td className="px-5 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${MOVEMENT_COLORS[m.movementType] ?? "bg-gray-100 text-gray-700"}`}>
                          {m.movementType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-foreground max-w-[160px] truncate">{m.product?.productName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{m.warehouse?.warehouseName}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-foreground">{m.qty}</td>
                      <td className="px-5 py-2.5 text-muted-foreground text-xs">{m.referenceId}</td>
                      <td className="px-5 py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
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
