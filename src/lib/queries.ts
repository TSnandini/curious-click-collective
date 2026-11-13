import { queryOptions } from "@tanstack/react-query";
import { getSystem } from "@/lib/reports.functions";

export const systemQuery = queryOptions({
  queryKey: ["system"],
  queryFn: () => getSystem(),
  staleTime: 5_000,
});

export type SystemState = Awaited<ReturnType<typeof getSystem>>;
export type ReportRow = SystemState["reports"][number];
export type HandlerRow = SystemState["handlers"][number];
