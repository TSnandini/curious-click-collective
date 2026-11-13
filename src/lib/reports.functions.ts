import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STATUSES } from "@/lib/complaint/constants";
import { reportInputSchema } from "@/lib/complaint/validate";

export const getSystem = createServerFn({ method: "GET" }).handler(async () => {
  const { getSystemState } = await import("@/lib/workflow.server");
  return getSystemState();
});

export const submitReportFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => reportInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { submitReport } = await import("@/lib/workflow.server");
    return submitReport(data);
  });

export const lookupReportFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().trim().toUpperCase().max(30) }).parse(input))
  .handler(async ({ data }) => {
    const { lookupReport } = await import("@/lib/workflow.server");
    return lookupReport(data.id);
  });

export const updateStatusFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().max(30), status: z.enum(STATUSES), note: z.string().max(200).default("") }).parse(input),
  )
  .handler(async ({ data }) => {
    const { updateReportStatus } = await import("@/lib/workflow.server");
    return updateReportStatus(data.id, data.status, data.note);
  });

export const updateHandlerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().max(20), available: z.boolean(), capacity: z.number().int().min(0).max(50) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { updateHandler } = await import("@/lib/workflow.server");
    return updateHandler(data.id, data.available, data.capacity);
  });

export const persistenceCheckFn = createServerFn({ method: "POST" }).handler(async () => {
  const { runPersistenceCheck } = await import("@/lib/workflow.server");
  return runPersistenceCheck();
});
