import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("RootLayout (_layout.tsx)", () => {
  it("envuelve la app en GestureHandlerRootView", () => {
    const codigo = readFileSync(join(__dirname, "../app/_layout.tsx"), "utf8");

    expect(codigo).toContain("GestureHandlerRootView");
    expect(codigo).toContain("Stack");
  });
});
