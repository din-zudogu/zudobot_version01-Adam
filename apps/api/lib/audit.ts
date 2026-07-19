import dbConnect from "@/lib/db/connect";
import ChatSessionModel from "@/models/chatSession";

export async function logSessionEvent(
  sessionId: string,
  tenantId: string,
  event: string,
  details?: any,
  actor: string = "system"
) {
  try {
    await dbConnect();
    await ChatSessionModel.updateOne(
      { sessionId, tenantId },
      {
        $push: {
          auditTrail: {
            event,
            details,
            timestamp: new Date(),
            actor,
          },
        },
      }
    );
  } catch (error) {
    console.error("Failed to log session event:", error);
  }
}

export async function logConfigChange(
  tenantId: string,
  key: string,
  oldValue: any,
  newValue: any,
  actor: string = "system"
) {
  // This would be logged in a separate config audit table if needed
  // For now, we'll log it in the session audit trail when configs affect sessions
  console.log(`Config change: ${key} from ${oldValue} to ${newValue} by ${actor}`);
}