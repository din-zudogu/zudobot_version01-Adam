import "server-only";

let bootstrapped = false;

/**
 * Run once per Node process in production after deploy / cold start.
 * Dynamic import keeps MongoDB / node:dns out of the client webpack graph.
 */
export async function runDeploymentPricingBootstrap(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  const { initializeDeploymentSync } = await import(
    "@/lib/services/pricingSyncService"
  );
  await initializeDeploymentSync();
}
