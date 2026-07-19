/**
 * Piggyback Self-Learning Scheduler
 *
 * Triggered on incoming widget chat requests (fire-and-forget).
 * Checks in-memory first (no DB hit on every request), then DB when
 * the in-memory TTL expires. Runs extraction only when:
 *   - enabled = true
 *   - now >= nextRunAt (or never run before)
 *   - not already running in this Lambda instance
 */
import { connectDB }              from "@/lib/db/connect";
import { SelfLearningConfigModel, getSelfLearningConfig } from "@/lib/db/models/SelfLearningConfig";
import { extractFewShotExamples } from "@/lib/ai/fewShotExtractor";

// In-memory state — shared within a single Lambda invocation lifetime
let _running        = false;
let _nextCheckAfter = 0;           // epoch ms — skip DB check until this time
const CHECK_COOLDOWN_MS = 5 * 60 * 1000; // recheck every 5 minutes at most

/**
 * Call this on each widget chat request (fire-and-forget, never throws).
 * Returns immediately — extraction runs in background.
 */
export function maybeRunSelfLearning(): void {
  const now = Date.now();

  // Skip: already running or in cooldown window
  if (_running || now < _nextCheckAfter) return;

  _nextCheckAfter = now + CHECK_COOLDOWN_MS;

  void (async () => {
    try {
      await connectDB();
      const cfg = await getSelfLearningConfig();

      if (!cfg.enabled) return;

      const intervalMs = cfg.intervalHours * 60 * 60 * 1000;
      const lastRun    = cfg.lastRunAt ? cfg.lastRunAt.getTime() : 0;

      if (now - lastRun < intervalMs) return; // not due yet

      _running = true;
      console.log("[SelfLearning] Starting scheduled extraction...");

      const result = await extractFewShotExamples(cfg.lookbackDays, cfg.maxPerRun);

      const nextRunAt = new Date(Date.now() + intervalMs);
      await SelfLearningConfigModel.updateOne(
        { key: "global" },
        {
          $set: {
            lastRunAt:  new Date(),
            nextRunAt,
            lastResult: result,
          },
        },
      );

      console.log(JSON.stringify({
        event:     "self_learning_run",
        scanned:   result.scanned,
        extracted: result.extracted,
        skipped:   result.skipped,
        duplicate: result.duplicate,
        nextRunAt: nextRunAt.toISOString(),
      }));
    } catch (e) {
      console.error("[SelfLearning] Scheduler error:", e);
    } finally {
      _running = false;
    }
  })();
}
