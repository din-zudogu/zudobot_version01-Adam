import { NextRequest, NextResponse } from "next/server";
import { runSandboxChat } from "@/lib/ai/geminiSandbox";
import { SANDBOX_SCENARIOS } from "@/components/sandbox/scenarios";
import type { ScenarioId } from "@/components/sandbox/scenarios";
import type { SandboxMessage } from "@/lib/ai/geminiSandbox";
import { enforceRateLimit, clientIp } from "@/lib/security/rateLimit";

// Demo sandbox limits: 20 messages/hour per IP (distributed via Upstash, so it
// holds across Lambda cold starts and instances) + 20 messages per UI session.
const SESSION_MESSAGE_LIMIT = 20;

export async function POST(req: NextRequest) {
  // --- IP rate limit (anti-abuse / cost-drain) ---
  const rl = await enforceRateLimit(clientIp(req), {
    prefix: "zudo:sandbox:rl",
    max:    20,
    window: "1 h",
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "rate_limit_ip", message: "คุณส่งข้อความมากเกินไป กรุณารอ 1 ชั่วโมงแล้วลองใหม่" },
      { status: 429 }
    );
  }

  // --- Parse body ---
  let body: {
    scenarioId: ScenarioId;
    history: SandboxMessage[];
    message: string;
    messageCount: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { scenarioId, history, message, messageCount } = body;

  // --- Session message limit ---
  if (messageCount >= SESSION_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: "session_limit", message: "คุณใช้ครบ 20 ข้อความแล้ว ลองสมัครใช้งานฟรี 14 วันเพื่อประสบการณ์เต็มรูปแบบ" },
      { status: 429 }
    );
  }

  // --- Validate scenario ---
  const scenario = SANDBOX_SCENARIOS[scenarioId];
  if (!scenario) {
    return NextResponse.json({ error: "invalid_scenario" }, { status: 400 });
  }

  // --- Validate message ---
  const trimmed = message?.trim();
  if (!trimmed || trimmed.length > 500) {
    return NextResponse.json({ error: "invalid_message" }, { status: 400 });
  }

  // --- Call Gemini ---
  const result = await runSandboxChat(scenario, history ?? [], trimmed);

  return NextResponse.json(
    { reply: result.reply, ipRemaining: rl.remaining },
    {
      status: 200,
      headers: { "X-RateLimit-Remaining": String(rl.remaining) },
    }
  );
}
