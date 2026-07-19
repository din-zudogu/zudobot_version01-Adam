export type BotGender = "female" | "male";
export type BotTone = "friendly" | "formal" | "playful";

export const BOT_GENDER_OPTIONS: {
  value: BotGender;
  label: string;
  desc: string;
}[] = [
  {
    value: "female",
    label: "ผู้หญิง",
    desc: "น้ำเสียงและคำลงท้ายแบบผู้หญิง (ค่ะ/คะ) — คุยกับลูกค้าได้เป็นธรรมชาติ",
  },
  {
    value: "male",
    label: "ผู้ชาย",
    desc: "น้ำเสียงและคำลงท้ายแบบผู้ชาย (ครับ) — คุยกับลูกค้าได้เป็นธรรมชาติ",
  },
];

export function isBotGender(value: unknown): value is BotGender {
  return value === "female" || value === "male";
}

/** Legacy profiles without botGender default to female for consistent Thai particles. */
export function resolveBotGender(value: unknown): BotGender {
  return isBotGender(value) ? value : "female";
}

export function defaultWelcomeMessage(botName: string, gender: BotGender): string {
  const name = botName.trim() || "บอท";
  if (gender === "male") {
    return `สวัสดีครับ! มีอะไรให้ ${name} ช่วยไหมครับ?`;
  }
  return `สวัสดีค่ะ! มีอะไรให้ ${name} ช่วยไหมคะ?`;
}
