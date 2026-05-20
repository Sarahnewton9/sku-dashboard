import { parsePptxBuffer } from "./server/pptx_parser.js";
import { readFileSync } from "fs";

const buf = readFileSync("/home/ubuntu/upload/2105lasts.pptx");
try {
  const result = await parsePptxBuffer(buf as unknown as Buffer);
  console.log("Slides parsed:", result.length);
  const errors = result.filter((r) => r.error);
  console.log("Slides with errors:", errors.length);
  if (errors.length > 0) console.log("First errors:", JSON.stringify(errors.slice(0, 3), null, 2));
  const goodSlides = result.filter((r) => !r.error && r.last);
  console.log("Good slides:", goodSlides.length);
  console.log("First good slide:", JSON.stringify(goodSlides[0], null, 2));
} catch (e: any) {
  console.error("PARSE ERROR:", e.message);
  console.error(e.stack);
}
