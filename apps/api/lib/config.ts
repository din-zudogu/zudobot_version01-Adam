import dbConnect from "@/lib/db/connect";
import ConfigModel from "@/models/config";

export async function getConfig(tenantId: string, key: string, defaultValue?: any): Promise<any> {
  try {
    await dbConnect();
    const config = await ConfigModel.findOne({ tenantId, key }).lean();
    return config ? config.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function getAllConfigs(tenantId: string): Promise<Record<string, any>> {
  try {
    await dbConnect();
    const configs = await ConfigModel.find({ tenantId }).lean();
    const result: Record<string, any> = {};
    configs.forEach((c) => {
      result[c.key] = c.value;
    });
    return result;
  } catch {
    return {};
  }
}

// Default config values
export const DEFAULT_CONFIGS = {
  max_product_recommendations: 3,
  alert_cooldown_minutes: 10,
  sentiment_thresholds: { frustrated: 6, angry: 8, crisis: 10 },
  handoff_rules: { auto_handoff_on_crisis: true, intent_support_request: true },
  prompt_injection_protection: true,
  pii_scrubbing_enabled: true,
};