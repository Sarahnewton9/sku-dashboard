/**
 * pptx_parser.ts — Node.js PPTX parser for Tony Bianco range review files.
 *
 * Replicates pptx_parser.py logic using JSZip (to unzip the PPTX) and
 * fast-xml-parser (to read the DrawingML XML). No Python required.
 *
 * Layout per slide:
 *  - One heading text box (top-left): contains the LAST name
 *    Identified by cyan (#00FFFF) highlight OR being the topmost text box.
 *  - Multiple style text boxes (one per style column):
 *    First paragraph = style name line
 *    Subsequent paragraphs = SKU lines (colour + leather)
 *
 * Highlight colours:
 *  #FF00FF  magenta  → specked (sample here)
 *  #00FFFF  cyan     → specked_no_sample
 *  #FFFF00  yellow   → not_specked
 *  #FF0000  red      → cancelled
 *  #00FF00  green    → ignore (Anthony's notes)
 *  none             → carry_over
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEATHER_TYPES = [
  "NAPPA PATENT", "PATENT TC", "HI SHINE", "NAPPA METALLIC",
  "NAPPA", "SUEDE", "PATENT", "CROCO", "VINTAGE", "VENICE",
  "NUBUCK", "KID", "METALLIC", "SPECKLE", "CRINKLE", "VELVET",
  "SATIN", "GLITTER", "MESH", "FABRIC", "LEATHER", "CANVAS",
  "BROCADE", "WOVEN", "NYLON", "SHINE", "COMO", "TC",
];

const NOT_COLOURS = new Set([
  "ADD", "NO", "TBC", "TBA", "SEE", "NB", "NOTE", "CHECK",
  "PENDING", "CONFIRM", "REFER", "ALSO", "PLUS", "NEW", "OLD",
  "YES", "OR", "AND", "THE", "FOR", "WITH", "FROM",
]);

const QUESTION_WORDS = new Set([
  "SHOULD", "COULD", "WOULD", "POSSIBLE", "MAYBE", "CONSIDER",
  "WHAT", "WHY", "HOW", "WHEN", "WHERE", "WHICH", "IF",
]);

const NOTE_KEYWORDS = [
  "HEEL", "HEIGHT", "LINING", "TOE PUFF", "COUNTER",
  "SIZE", "CM", "MM", "NOTE", "NB:", "SEE", "REFER",
  "CHECK", "TBC", "TBA", "PENDING", "CONFIRM",
  "MICRO STRETCH", "MICRO STRECH",
];

const FALSE_POSITIVE_STYLES = new Set([
  "HEEL", "SKIN", "MILK", "WEDGE", "SOLE", "UPPER",
  "LINING", "INSOLE", "OUTSOLE", "COUNTER", "TOE",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkuStatus = "specked" | "specked_no_sample" | "not_specked" | "cancelled" | "carry_over" | "ignore";

export interface ParsedSku {
  colour: string;
  leather: string;
  status: SkuStatus;
}

export interface ParsedStyle {
  style: string;
  skus: ParsedSku[];
}

export interface ParsedSlide {
  last: string;
  styles: ParsedStyle[];
  error?: string;
}

// ─── Highlight classification ─────────────────────────────────────────────────

function classifyHighlight(hex: string | null): SkuStatus {
  if (!hex) return "carry_over";
  const h = hex.toUpperCase();
  if (h === "#FF00FF" || h === "FF00FF") return "specked";
  if (h === "#00FFFF" || h === "00FFFF") return "specked_no_sample";
  if (h === "#FFFF00" || h === "FFFF00") return "not_specked";
  if (h === "#FF0000" || h === "FF0000") return "cancelled";
  if (h === "#00FF00" || h === "00FF00") return "ignore";
  return "carry_over";
}

// ─── Text extraction helpers ──────────────────────────────────────────────────

function extractLastName(text: string): string | null {
  // Split on dash, em-dash, en-dash, dollar
  const parts = text.split(/[\u2013\u2014\-\$]/);
  let name = parts[0].trim();
  // Keep only letters and spaces
  name = name.replace(/[^A-Za-z\s]/g, "").trim().toUpperCase();
  // Take only the first word
  const firstWord = name.split(/\s+/)[0];
  return firstWord || null;
}

function extractStyleName(line: string): string | null {
  line = line.trim();
  if (!line) return null;
  // Split on dash, em-dash, en-dash, dollar, space+digit
  const core = line.split(/[\u2013\u2014\-\$]|\s+\d/)[0].trim();
  const words = core.split(/\s+/);
  if (!words.length) return null;
  const first = words[0];
  // Must be all uppercase letters, 2-15 chars
  if (/^[A-Z]{2,15}$/.test(first)) return first;
  return null;
}

function isNoteLine(text: string): boolean {
  text = text.trim();
  if (!text) return true;
  // Contains lowercase = likely a note
  if (/[a-z]/.test(text)) return true;
  // Known note keywords
  const upper = text.toUpperCase();
  for (const kw of NOTE_KEYWORDS) {
    if (upper.includes(kw)) return true;
  }
  return false;
}

function splitColourLeather(text: string): [string | null, string | null] {
  // Clean asterisks and trailing notes
  text = text.replace(/\s*\*.*$/, "").trim();
  // Split on slash for two-tone — use only the primary (first) part
  const primary = text.split("/")[0].trim();
  return splitSingle(primary);
}

function splitSingle(text: string): [string | null, string | null] {
  const words = text.trim().toUpperCase().split(/\s+/);
  if (!words.length) return [null, null];

  // Try two-word leather types first (longest match, scanning right-to-left)
  for (let i = words.length - 1; i >= 0; i--) {
    // Two-word match
    if (i > 0) {
      const two = words[i - 1] + " " + words[i];
      if (LEATHER_TYPES.includes(two)) {
        const colour = words.slice(0, i - 1).join(" ").trim();
        return [colour || null, two];
      }
    }
    // One-word match
    if (LEATHER_TYPES.includes(words[i])) {
      const colour = words.slice(0, i).join(" ").trim();
      return [colour || null, words[i]];
    }
  }
  return [null, null];
}

function parseSkuLine(text: string, highlight: string | null): ParsedSku | null {
  text = text.trim();
  if (!text || isNoteLine(text)) return null;
  const status = classifyHighlight(highlight);
  if (status === "ignore") return null;
  const [colour, leather] = splitColourLeather(text);
  if (!colour || !leather) return null;
  if (NOT_COLOURS.has(colour.toUpperCase())) return null;
  const colourWords = colour.toUpperCase().split(/\s+/);
  if (colourWords.some((w) => QUESTION_WORDS.has(w))) return null;
  if (colourWords.length > 4) return null;
  return { colour, leather, status };
}

// ─── XML parsing helpers ──────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["p:sp", "a:p", "a:r", "a:t", "a:rPr", "a:highlight"].includes(name),
  removeNSPrefix: false,
});

interface RunInfo {
  text: string;
  highlight: string | null;
}

interface ParaInfo {
  text: string;
  highlight: string | null; // first highlighted run
}

interface ShapeInfo {
  top: number;
  left: number;
  paragraphs: ParaInfo[];
}

function parseShapeXml(spXml: any): ShapeInfo | null {
  try {
    // Position
    const spPr = spXml["p:spPr"];
    const xfrm = spPr?.["p:xfrm"] ?? spPr?.["a:xfrm"];
    const off = xfrm?.["a:off"];
    const top = parseInt(off?.["@_y"] ?? "0", 10);
    const left = parseInt(off?.["@_x"] ?? "0", 10);

    // Text frame
    const txBody = spXml["p:txBody"];
    if (!txBody) return null;

    const rawParas = txBody["a:p"];
    if (!rawParas || !Array.isArray(rawParas)) return null;

    const paragraphs: ParaInfo[] = [];

    for (const para of rawParas) {
      const runs: RunInfo[] = [];
      const rawRuns = para["a:r"];
      if (Array.isArray(rawRuns)) {
        for (const run of rawRuns) {
          const tArr = run["a:t"];
          const text = Array.isArray(tArr) ? tArr.map((t: any) => (typeof t === "string" ? t : t["#text"] ?? "")).join("") : (typeof tArr === "string" ? tArr : tArr?.["#text"] ?? "");
          // Highlight from rPr
          let highlight: string | null = null;
          const rPrArr = run["a:rPr"];
          const rPr = Array.isArray(rPrArr) ? rPrArr[0] : rPrArr;
          if (rPr) {
            const hlArr = rPr["a:highlight"];
            const hl = Array.isArray(hlArr) ? hlArr[0] : hlArr;
            if (hl) {
              const srgb = hl["a:srgbClr"];
              if (srgb) {
                const val = srgb["@_val"] ?? (typeof srgb === "string" ? srgb : null);
                if (val) highlight = "#" + val.toUpperCase();
              }
            }
          }
          runs.push({ text: String(text), highlight });
        }
      }

      const fullText = runs.map((r) => r.text).join("").trim();
      const firstHighlight = runs.find((r) => r.highlight)?.highlight ?? null;
      paragraphs.push({ text: fullText, highlight: firstHighlight });
    }

    return { top, left, paragraphs };
  } catch {
    return null;
  }
}

// ─── Slide parser ─────────────────────────────────────────────────────────────

function parseSlide(slideXml: string): ParsedSlide | null {
  const parsed = xmlParser.parse(slideXml);
  const spTree = parsed?.["p:sld"]?.["p:cSld"]?.["p:spTree"];
  if (!spTree) return null;

  const rawShapes = spTree["p:sp"];
  if (!Array.isArray(rawShapes) || rawShapes.length === 0) return null;

  // Parse all shapes
  const shapes: ShapeInfo[] = [];
  for (const sp of rawShapes) {
    const shape = parseShapeXml(sp);
    if (shape && shape.paragraphs.some((p) => p.text)) {
      shapes.push(shape);
    }
  }

  if (shapes.length === 0) return null;

  // Sort top→bottom, left→right
  shapes.sort((a, b) => a.top - b.top || a.left - b.left);

  // Find heading box: prefer cyan-highlighted box, else topmost
  let headingShape: ShapeInfo | null = null;
  let lastName: string | null = null;

  for (const shape of shapes) {
    const hasCyan = shape.paragraphs.some((p) => {
      const h = p.highlight?.toUpperCase();
      return h === "#00FFFF" || h === "00FFFF";
    });
    if (hasCyan || headingShape === null) {
      headingShape = shape;
      const allText = shape.paragraphs.map((p) => p.text).join(" ").trim();
      lastName = extractLastName(allText);
      if (hasCyan) break;
    }
  }

  if (!lastName) return null;

  // Parse each remaining shape as a potential style column
  const styles: ParsedStyle[] = [];

  for (const shape of shapes) {
    if (shape === headingShape) continue;

    const paras = shape.paragraphs.filter((p) => p.text);
    if (paras.length === 0) continue;

    const [firstPara, ...rest] = paras;
    if (isNoteLine(firstPara.text)) continue;

    const styleName = extractStyleName(firstPara.text);
    if (!styleName) continue;
    if (FALSE_POSITIVE_STYLES.has(styleName)) continue;

    const skus: ParsedSku[] = [];
    for (const para of rest) {
      const sku = parseSkuLine(para.text, para.highlight);
      if (sku) skus.push(sku);
    }

    styles.push({ style: styleName, skus });
  }

  return { last: lastName, styles };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function parsePptxBuffer(buffer: Buffer): Promise<ParsedSlide[]> {
  const zip = await JSZip.loadAsync(buffer);
  const results: ParsedSlide[] = [];

  // Get slide list from presentation.xml
  const presXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presXml) throw new Error("Not a valid PPTX: missing presentation.xml");

  // Find all slide files (ppt/slides/slide1.xml, slide2.xml, ...)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return na - nb;
    });

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    try {
      const xml = await zip.file(slideFile)?.async("string");
      if (!xml) continue;
      const data = parseSlide(xml);
      if (data && data.last) {
        results.push(data);
      }
    } catch (e: any) {
      results.push({ last: "", styles: [], error: `Slide ${i + 1}: ${e.message}` });
    }
  }

  return results;
}
