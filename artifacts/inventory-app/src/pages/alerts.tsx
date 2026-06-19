import { useListAlerts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ALERT_COLORS: Record<string, string> = {
  LOW_STOCK: "bg-amber-100 text-amber-700",
  OUT_OF_STOCK: "bg-red-100 text-red-700",
  EXPIRY: "bg-orange-100 text-orange-700",
  REORDER: "bg-blue-100 text-blue-700",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-red-100 text-red-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
};

export default function Alerts() {
  const { data, isLoading } = useListAlerts({ limit: 100 });

  return (
    <div className="space-y-5">
      <Card className="border border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.data?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No alerts. Everything looks healthy!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Alert Type", "Product", "SKU", "Current Stock", "Threshold", "Status", "When"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((a: any) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ALERT_COLORS[a.alert_type] ?? "bg-gray-100 text-gray-700"}`}>{a.alert_type}</span>
                      </td>
                      <td className="px-4 py-3 font-medium">{a.product?.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{a.product?.sku_code}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{a.current_stock ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.threshold ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-700"}`}>{a.status}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
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
