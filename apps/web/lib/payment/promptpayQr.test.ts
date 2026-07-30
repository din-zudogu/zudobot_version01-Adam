import { describe, it, expect } from "vitest";
import { normalizePromptPayId, isValidPromptPayId } from "./promptpayQr";

describe("normalizePromptPayId", () => {
  it("strips dashes and spaces", () => {
    expect(normalizePromptPayId("081-234-5678")).toBe("0812345678");
    expect(normalizePromptPayId("0 8 1 2 3 4 5 6 7 8")).toBe("0812345678");
  });

  it("leaves an already-clean id unchanged", () => {
    expect(normalizePromptPayId("0812345678")).toBe("0812345678");
  });
});

describe("isValidPromptPayId", () => {
  it("accepts a 10-digit Thai mobile number starting with 0", () => {
    expect(isValidPromptPayId("0812345678")).toBe(true);
    expect(isValidPromptPayId("081-234-5678")).toBe(true);
  });

  it("accepts a 13-digit citizen/tax ID", () => {
    expect(isValidPromptPayId("1234567890123")).toBe(true);
  });

  it("rejects a mobile number not starting with 0", () => {
    expect(isValidPromptPayId("1812345678")).toBe(false);
  });

  it("rejects wrong-length numbers", () => {
    expect(isValidPromptPayId("08123456")).toBe(false);
    expect(isValidPromptPayId("123456789012")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidPromptPayId("081abc5678")).toBe(false);
  });
});
