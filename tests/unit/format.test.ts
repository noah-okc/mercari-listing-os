import { describe, expect, it } from "vitest";
import { formatYen, parseYenInput } from "@/lib/format";

describe("formatYen", () => {
  it("桁区切りと符号", () => {
    expect(formatYen(1234567)).toBe("¥1,234,567");
    expect(formatYen(-100)).toBe("-¥100");
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(null)).toBe("—");
  });
});

describe("parseYenInput", () => {
  it("全角数字・カンマ・円記号を受け付ける", () => {
    expect(parseYenInput("３，０００円")).toBe(3000);
    expect(parseYenInput("¥1,200")).toBe(1200);
    expect(parseYenInput("")).toBeNull();
    expect(parseYenInput("abc")).toBeNull();
  });
});
