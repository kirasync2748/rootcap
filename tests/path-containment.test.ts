import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Exercise each server's actual containment function with native Node path
// semantics for both platforms, even when the tests run on Linux.
function containment(server: string, root: string, platform: typeof path.posix) {
  const source = readFileSync(new URL(`../${server}`, import.meta.url), "utf8");
  const expression = source.match(/const inside = (\([^)]*\) => \{[\s\S]*?\n\s*\});/);
  if (!expression) throw new Error(`Cannot find containment function in ${server}`);
  const inside = runInNewContext(`(${expression[1]})`, {
    root,
    relative: platform.relative,
    isAbsolute: platform.isAbsolute,
    sep: platform.sep,
  }) as (...args: string[]) => boolean;
  return (file: string) => (server === "server.mjs" ? inside(root, file) : inside(file));
}

describe.each(["server.mjs", "demo/server.mjs"])("%s path containment", (server) => {
  it("accepts descendants and rejects parent, sibling and cross-drive paths on Windows", () => {
    const inside = containment(server, "C:\\demo\\dist", path.win32);
    expect(inside("C:\\demo\\dist")).toBe(true);
    expect(inside("C:\\demo\\dist\\assets\\main.js")).toBe(true);
    expect(inside("C:\\demo\\dist\\..safe\\file.js")).toBe(true);
    expect(inside("C:\\demo")).toBe(false);
    expect(inside("C:\\demo\\server.mjs")).toBe(false);
    expect(inside("C:\\demo\\dist-other\\file.js")).toBe(false);
    expect(inside("D:\\outside\\secret")).toBe(false);
  });

  it("accepts descendants and rejects paths outside the POSIX root", () => {
    const inside = containment(server, "/demo/dist", path.posix);
    expect(inside("/demo/dist/assets/main.js")).toBe(true);
    expect(inside("/demo/dist/..safe/file.js")).toBe(true);
    expect(inside("/demo/server.mjs")).toBe(false);
    expect(inside("/demo/dist-other/file.js")).toBe(false);
  });
});
