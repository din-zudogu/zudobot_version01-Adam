/**
 * Audit logging for session events in the web app.
 * Writes into ConversationSession.auditTrail (if field exists) or no-ops safely.
 */
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";

export type AuditEvent = "pause" | "resume" | "handoff" | "alert_sent" | "config_change" | "pii_detected" | "deep_link_used";
export type AuditActor = "system" | "admin" | "bot";

export async function logSessionEvent(
  sessionId: string,
  tenantId:  string,
  event:     AuditEvent,
  details:   Record<string, unknown> = {},
  actor:     AuditActor = "system",
): Promise<void> {
  try {
    // Append to auditTrail if the field is supported; silent no-op otherwise
    await ConversationSessionModel.updateOne(
      { sessionId, tenantId },
      {
        $push: {
            auditTrail: { event, details, actor, timestamp: new Date() } as never,
        },
      }
    );
  } catch {
    // Audit logging is non-critical — never throw
  }
}
