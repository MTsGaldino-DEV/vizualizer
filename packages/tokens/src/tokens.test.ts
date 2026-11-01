import { describe, expect, it } from "vitest";
import { cores, cssVars } from "./index";

describe("tokens", () => {
  it("cor da marca é a lima elétrica", () => expect(cores.sinal).toBe("#C8FF2E"));
  it("exporta uma variável CSS por cor", () =>
    expect(Object.keys(cssVars)).toHaveLength(Object.keys(cores).length));
});
