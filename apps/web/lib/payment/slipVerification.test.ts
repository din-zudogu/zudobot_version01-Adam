import { describe, it, expect } from "vitest";
import { parseSlipAnalysisResponse, decideVerificationOutcome, type SlipAnalysisResult } from "./slipVerification";

describe("parseSlipAnalysisResponse", () => {
  it("parses a well-formed JSON response", () => {
    const raw = `{
      "isLikelySlip": true,
      "amountThb": 590.5,
      "bankName": "SCB",
      "transactionRef": "ABC123",
      "transactionDateTime": "30/07/2026 10:15",
      "confidence": 0.92,
      "suspiciousReasons": []
    }`;
    const result = parseSlipAnalysisResponse(raw);
    expect(result).toEqual({
      isLikelySlip: true,
      amountThb: 590.5,
      bankName: "SCB",
      transactionRef: "ABC123",
      transactionDateTime: "30/07/2026 10:15",
      confidence: 0.92,
      suspiciousReasons: [],
    });
  });

  it("extracts JSON even when wrapped in markdown code fences / extra prose", () => {
    const raw = "here is the result:\n```json\n{\"isLikelySlip\":true,\"amountThb\":100,\"bankName\":null,\"transactionRef\":null,\"transactionDateTime\":null,\"confidence\":0.5,\"suspiciousReasons\":[]}\n```\nthanks";
    const result = parseSlipAnalysisResponse(raw);
    expect(result.isLikelySlip).toBe(true);
    expect(result.amountThb).toBe(100);
  });

  it("degrades to the safe default on unparseable text — never throws", () => {
    const result = parseSlipAnalysisResponse("I cannot analyze this image.");
    expect(result.isLikelySlip).toBe(false);
    expect(result.amountThb).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.suspiciousReasons).toContain("ai_response_unparseable");
  });

  it("clamps confidence into [0,1] and drops non-positive amounts", () => {
    const raw = `{"isLikelySlip":true,"amountThb":-5,"confidence":1.7,"suspiciousReasons":[]}`;
    const result = parseSlipAnalysisResponse(raw);
    expect(result.confidence).toBe(1);
    expect(result.amountThb).toBeNull();
  });

  it("filters non-string entries out of suspiciousReasons", () => {
    const raw = `{"isLikelySlip":true,"amountThb":50,"confidence":0.5,"suspiciousReasons":["font mismatch", 42, null]}`;
    const result = parseSlipAnalysisResponse(raw);
    expect(result.suspiciousReasons).toEqual(["font mismatch"]);
  });
});

describe("decideVerificationOutcome", () => {
  const base: SlipAnalysisResult = {
    isLikelySlip: true,
    amountThb: 500,
    bankName: "SCB",
    transactionRef: "ref",
    transactionDateTime: "now",
    confidence: 0.9,
    suspiciousReasons: [],
  };

  it("returns not_a_slip when the image isn't recognized as a slip", () => {
    expect(decideVerificationOutcome({ ...base, isLikelySlip: false }, 0.75)).toBe("not_a_slip");
  });

  it("auto-verifies when confidence meets the threshold, amount present, no suspicion", () => {
    expect(decideVerificationOutcome(base, 0.75)).toBe("auto_verified");
  });

  it("holds for review when confidence is below the threshold", () => {
    expect(decideVerificationOutcome({ ...base, confidence: 0.5 }, 0.75)).toBe("pending_review");
  });

  it("holds for review right at the boundary minus epsilon", () => {
    expect(decideVerificationOutcome({ ...base, confidence: 0.749 }, 0.75)).toBe("pending_review");
  });

  it("auto-verifies exactly at the threshold", () => {
    expect(decideVerificationOutcome({ ...base, confidence: 0.75 }, 0.75)).toBe("auto_verified");
  });

  it("holds for review when amount couldn't be extracted, even with high confidence", () => {
    expect(decideVerificationOutcome({ ...base, amountThb: null }, 0.75)).toBe("pending_review");
  });

  it("holds for review when any suspicious reasons are flagged, even with high confidence", () => {
    expect(decideVerificationOutcome({ ...base, suspiciousReasons: ["font mismatch"] }, 0.75)).toBe("pending_review");
  });
});
