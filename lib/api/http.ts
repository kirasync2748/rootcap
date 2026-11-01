import type { IncomingMessage } from "node:http";

/** Bound untrusted request bodies before parsing JSON. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    if (tooLarge) continue;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 65536) {
      tooLarge = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(buffer);
  }
  if (tooLarge) throw new Error("body_too_large");
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
