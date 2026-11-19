import { collectDefaultMetrics, register } from "@prometheus-io/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForMetrics = globalThis as typeof globalThis & {
  spacareMetricsInitialized?: boolean;
};

if (!globalForMetrics.spacareMetricsInitialized) {
  collectDefaultMetrics();
  globalForMetrics.spacareMetricsInitialized = true;
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  return new Response(await register.metrics(), {
    headers: {
      "Content-Type": register.contentType,
      "Cache-Control": "no-store",
    },
  });
}
