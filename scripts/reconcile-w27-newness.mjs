import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

const input = `
COMMA\tCHOC NAPPA
COMMA\tLIPSTICK SUEDE
COMMA\tROYAL SUEDE
COMMA\tCLOUD SUEDE
COMMA\tMIDNIGHT SUEDE
COMMA\tPURPLE SUEDE
COMMA\tVINO SUEDE
COMMA\tRED SUEDE
COMMA\tGREY SUEDE
CHELSEA\tBLOSSOM NAPPA
CHELSEA\tVANILLA NAPPA
CHELSEA\tCLOUD NAPPA
CHELSEA\tMINT NAPPA
CAPPA\tBLK NAPPA A/O
CHERRY\tCLOUD SUEDE
CHERRY\tSTONE SUEDE
CHERRY\tBLOSSOM SUEDE
CHERRY\tVIPER SNAKE
CHERRY\tVINO CRINKLE
DIXON\tVIPER SNAKE
DIXON\tSERPE SNAKE
DIMA\tSTONE SUEDE/VIPER SNAKE
DIMA\tESPRESSO SUEDE/SERPE SNAKE
DIMA\tCLOUD SUEDE/CLOUD SNAKE
DIMA\tVINO SUEDE/VINO SNAKE
DELUXE\tVINO NYLON/VINO SNAKE
DELUXE\tGEM NYLON/GEM SNAKE
DELUXE\tCLOUD NYLON/CLOUD SNAKE
DIXIE\tCLOUD SUEDE
DIXIE\tBLOSSOM SUEDE
DIXIE\tRED SUEDE
DONTE\tVINO NYLON/VINO SNAKE
DONTE\tSKIN NYLON/VIPER SNAKE
DEVYN\tBLACK NYLON/BLACK NAPPA
DEVYN\tCHOC NYLON/CHOC NAPPA
DEVYN\tCLOUD NYLON/CLOUD NAPPA
DILLON\tBLACK SUEDE
DILLON\tGREY SUEDE
DILLON\tMIDNIGHT SUEDE
DILLON\tSERPE SNAKE
DILLON\tECRU SNAKE
DAZIE\tBLACK NAPPA
DAZIE\tDOVE NAPPA
DAZIE\tCHOC NAPPA
DAZIE\tBLOSSOM NAPPA
DAZIE (VINTAGE)\tBLACK VINTAGE
DAZIE (VINTAGE)\tESPRESSO VINTAGE
DAZIE (VINTAGE)\tLEOPARD PONY
DAZIE (VINTAGE)\tSERPE SNAKE
KASSY\tVIPER SNAKE/STONE SUEDE
KASSY\tCLOUD SNAKE/CLOUD SUEDE
KASSY\tVINO SNAKE/VINO SUEDE
ENVY\tRED SUEDE
ENVY\tPURPLE SUEDE
ENVY\tLIPSTICK SUEDE
ENVY\tROYAL SUEDE
ESQUIRE\tCLOUD SUEDE
ESQUIRE\tBLOSSOM SUEDE
ESQUIRE\tFOREST SUEDE
ESQUIRE\tGREY SUEDE
EMILY\tESPRESSO VINTAGE/ESPRESSO SUEDE
EMILY\tVANILLA VINTAGE/STONE SUEDE
EMILY\tBLACK VINTAGE/BLACK SUEDE
ELECTRIC\tSKIN NYLON/VIPER SNAKE
ELECTRIC\tBLACK NYLON/ECRU SNAKE
ELECTRIC\tGEM NYLON/GEM SNAKE
ELECTRIC\tCLOUD NYLON/CLOUD SNAKE
ELECTRIC\tVINO NYLON/VINO SNAKE
ELECTRIC\tCLEAR VINYLITE/BLACK PATENT
EMAR\tVIPER SNAKE
EMAR\tBLACK CRINKLE
EMAR\tCHOC CRINKLE
EMAR\tVINO CRINKLE
MADDI\tMINT NAPPA
MADDI\tBLOSSOM NAPPA
MADDI\tCLOUD NAPPA
MOMA\tGREY SUEDE
MOMA\tCLOUD SUEDE
MOMA\tESPRESSO SUEDE
MOMA\tBLOSSOM SUEDE
MOMA\tLIPSTICK SUEDE
MOMA\tROYAL SUEDE
MOMA\tMIDNIGHT SUEDE
SAMMY\tDOVE NAPPA
SAMMY\tCHOCOLATE VENICE
SAMMY\tBLACK COMO
`.trim();

const entries = input.split("\n").map((line) => {
  const [style, description] = line.split("\t");
  return { style: style.trim().toUpperCase(), description: description.trim().toUpperCase() };
});

const skuDataSource = await readFile(new URL("../client/src/lib/skuData.ts", import.meta.url), "utf8");
const staticStyleMatches = [...skuDataSource.matchAll(/"style":"([^"]+)"/g)].map((match) => match[1].toUpperCase());
const staticStyles = new Set(staticStyleMatches);

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [customStyles] = await connection.execute(
  "SELECT style, last_name AS lastName, category FROM custom_styles WHERE season = 'W27'",
);
const [customSkus] = await connection.execute(
  "SELECT style, colour, leather, colour2, leather2 FROM custom_skus WHERE season = 'W27'",
);
const [cancelledStyles] = await connection.execute(
  "SELECT style FROM cancelled_styles WHERE season = 'W27'",
);
await connection.end();

const customStyleMap = new Map(customStyles.map((row) => [row.style.toUpperCase(), row]));
const cancelledStyleSet = new Set(cancelledStyles.map((row) => row.style.toUpperCase()));
const requestedByStyle = new Map();
for (const entry of entries) {
  const existing = requestedByStyle.get(entry.style) ?? [];
  existing.push(entry.description);
  requestedByStyle.set(entry.style, existing);
}

const report = [...requestedByStyle.entries()].map(([style, descriptions]) => ({
  style,
  requestedColourways: descriptions.length,
  status: cancelledStyleSet.has(style)
    ? "CANCELLED_IN_W27"
    : staticStyles.has(style)
      ? "STATIC_STYLE"
      : customStyleMap.has(style)
        ? "W27_CUSTOM_STYLE"
        : "NEW_STYLE_NEEDS_LAST_AND_CATEGORY",
  existingW27Parent: customStyleMap.get(style) ?? null,
  existingW27CustomColourways: customSkus
    .filter((sku) => sku.style.toUpperCase() === style)
    .map((sku) => `${sku.colour}${sku.leather ? ` ${sku.leather}` : ""}${sku.colour2 ? ` / ${sku.colour2}${sku.leather2 ? ` ${sku.leather2}` : ""}` : ""}`),
  requestedDescriptions: descriptions,
}));

console.log(JSON.stringify({ entryCount: entries.length, styleCount: requestedByStyle.size, report }, null, 2));
