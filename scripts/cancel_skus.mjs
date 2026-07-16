import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Known leather types (longest match first to handle "NAPPA METALLIC" before "NAPPA")
const LEATHERS = [
  "NAPPA METALLIC", "NAPPA PATENT", "LUMIA VELVET", "VINTAGE METAL",
  "HI SHINE", "MESH/PATENT", "MESH/VINTAGE",
  "ANGUILLE", "BRAID", "BROCADE", "BURNISH", "CAPRETTO", "CAPRI",
  "COMO", "CRINKLE", "CROC", "CROCO", "FOIL", "GLOMESH",
  "KID", "MAGIC", "MESH", "METALLIC", "MICRO",
  "NAPPA", "NUBUCK", "NYLON", "PATENT", "PONY",
  "SATIN", "SCUBA", "SHINE", "SNAKE", "SPECKLE", "SUEDE",
  "TULLE", "TURIN", "TUSCON", "VALENCIA", "VENICE",
  "VINTAGE", "VINYLITE", "WEAVE", "WOVEN",
  "PYTHON", "WAX", "NETTA", "PLAIT", "RAFFIA", "CROCHET", "SOFT VINTAGE",
];

// Sort by length descending so longer matches win
LEATHERS.sort((a, b) => b.length - a.length);

function parseColourLeather(combined) {
  const upper = combined.toUpperCase();
  for (const leather of LEATHERS) {
    if (upper.endsWith(leather)) {
      const colour = combined.slice(0, combined.length - leather.length).trim().replace(/\/$/, '').trim();
      return { colour: colour.toUpperCase(), leather };
    }
  }
  // fallback: last word is leather
  const parts = combined.trim().split(/\s+/);
  const leather = parts.pop().toUpperCase();
  const colour = parts.join(' ').toUpperCase();
  return { colour, leather };
}

const entries = [
  ["Alyx", "Cemento Suede"],
  ["Alyx", "Ashen Suede"],
  ["Amelia", "Black Vintage"],
  ["Amelia", "Choc Vintage"],
  ["Annie", "Taupe Suede"],
  ["Annie", "Espresso Suede"],
  ["Annie", "Black Suede"],
  ["Annie", "Scarlet Suede"],
  ["Axell", "Black Hi Shine"],
  ["Bag-Breezy", "Natural Crochet"],
  ["Bag-Chill", "Natural Raffia"],
  ["Bag-Elsie", "Wheat Suede"],
  ["Bag-Elsie", "Black Soft Vintage"],
  ["Bag-Elsie", "Ecru Soft Vintage"],
  ["Bag-Evie", "Wheat Suede"],
  ["Bag-Evie", "Espresso Suede"],
  ["Bag-Evie", "Dove Soft Vintage"],
  ["Bag-Evie", "Black Suede"],
  ["Bag-Mabel", "Dove Soft Vintage"],
  ["Bag-Mabel", "Black Soft Vintage"],
  ["BAG-MILY", "Espresso Suede"],
  ["BAG-MILY", "Black Suede"],
  ["BAG-MILY", "Black Soft Vintage"],
  ["Bag-Zarly", "Black Soft Vintage"],
  ["Bertie", "Black Hi Shine"],
  ["Bertie", "White Hi Shine"],
  ["Bettina", "Espresso Suede"],
  ["Bettina", "Black Nappa"],
  ["Bettina", "Cemento Suede"],
  ["Bettina", "Dove Nappa"],
  ["Bianca", "Liqueur Crinkle"],
  ["Biker", "Whiskey Wax"],
  ["Bless", "Cognac Vintage"],
  ["Breeze", "Denim Nylon"],
  ["Cammie", "Wheat Suede"],
  ["Cammie", "Black Suede"],
  ["Cammie", "Blossom Suede"],
  ["Cammie", "Espresso Suede"],
  ["Caprice", "Tan Nappa"],
  ["Caprice", "Gold Nappa Metallic"],
  ["Carly", "White Plait"],
  ["Carly", "Black Plait"],
  ["Catie", "Nude Patent"],
  ["Catie", "Black Patent"],
  ["Charli", "Dove Nappa"],
  ["Charlotte", "Nude Patent"],
  ["Chloe", "Choc Satin"],
  ["Collette", "Vestra Valencia"],
  ["Collette", "Black Valencia"],
  ["Collette", "Choc Valencia"],
  ["Concorde", "Black Suede"],
  ["Concorde", "Navy Suede"],
  ["Concorde", "Espresso Suede"],
  ["Concorde", "Honey Pony"],
  ["Concorde", "Black Pony"],
  ["Cosmic", "Black Satin"],
  ["Costa", "Vino Suede"],
  ["Costa", "Navy Suede"],
  ["Costa", "Cemento Suede"],
  ["Crush", "Wheat Suede"],
  ["Crush", "Jade Nubuck"],
  ["Crush", "Fuchsia Nubuck"],
  ["Dana", "Denim Vintage"],
  ["Dolli", "Clear Vinylite/Silver"],
  ["Dolli", "Clear Vinylite/Skin"],
  ["Dreamer", "Nude Patent"],
  ["Dynasty", "White Hi Shine"],
  ["Dynasty", "Mocha Patent"],
  ["Edgy", "Jade Nubuck"],
  ["Eloise", "Black Como"],
  ["Eloise", "Espresso Suede"],
  ["Flex", "Black Suede"],
  ["Gemma", "Taupe Suede"],
  ["Gezza", "Black Hi Shine"],
  ["Gezza", "Black Suede"],
  ["Gezza", "Espresso Suede"],
  ["Gigi", "Espresso Suede"],
  ["Gigi", "Tan Vintage"],
  ["Gigi", "Black Suede"],
  ["Gomez", "Espresso Anguille"],
  ["Gomez", "Black Anguille"],
  ["Hallie", "Fuchsia Nubuck"],
  ["Hunter", "Vanilla Capretto"],
  ["Izia", "Whiskey"],
  ["Izia", "Black Vintage"],
  ["Jayla", "Black Hi Shine"],
  ["Jesse", "Taupe Suede"],
  ["Jesse", "Ashen Suede"],
  ["Jett", "Stone Scuba"],
  ["Juniper", "Espresso Suede"],
  ["Juniper", "Ashen Suede"],
  ["Juniper", "Vino Anguille"],
  ["Juniper", "Steel Suede"],
  ["Libby", "Espresso Anguille"],
  ["Libby", "Vino Anguille"],
  ["Martini", "White Nappa"],
  ["Martini", "Black Patent"],
  ["Martini", "Coco Patent"],
  ["Maya", "Amber Nappa Metallic"],
  ["Mia", "White Mesh/Patent"],
  ["Mia", "Choc Mesh/Vintage"],
  ["Mia", "Skin Mesh/Patent"],
  ["Mia", "Denim Mesh/Vintage"],
  ["Micky", "White Nappa"],
  ["Milos", "White Hi Shine"],
  ["Mimzy", "Black Netta"],
  ["Mimzy", "Choc Netta"],
  ["Mimzy", "Steel Netta"],
  ["Mimzy", "White Netta"],
  ["Mimzy", "Skin Netta"],
  ["Minaj", "White Mesh/Patent"],
  ["Minaj", "Black Mesh/Patent"],
  ["Minaj", "Skin Mesh/Patent"],
  ["Minaj", "Choc Mesh/Vintage"],
  ["Monaco", "Black Como"],
  ["Monaco", "Tan Como"],
  ["Monaco", "Choc Como"],
  ["Monique", "Choc Como"],
  ["Monique", "Black Como"],
  ["Mustang", "Black Suede"],
  ["Mustang", "Wheat Suede"],
  ["Mustang", "Vino Suede"],
  ["Mustang", "Ashen Suede"],
  ["Nellie", "Black Vintage"],
  ["Nellie", "Dove Nappa"],
  ["Nellie", "Choc Vintage"],
  ["Nellie", "Skin Nappa"],
  ["Paris", "Navy Suede"],
  ["Paris", "Taupe Suede"],
  ["Paris", "Steel Suede"],
  ["Paris", "Lapis Nubuck"],
  ["Paris", "Blush Nubuck"],
  ["Paris", "Tangerine Nubuck"],
  ["Paris", "Jade Nubuck"],
  ["Paris", "Purple Nubuck"],
  ["Penelope", "Vestra Valencia"],
  ["Rihanna", "Espresso Suede"],
  ["Rihanna", "Black Suede"],
  ["Rihanna", "Steel Suede"],
  ["Rinetta", "Tan Vintage"],
  ["Rinetta", "Black Valencia"],
  ["Rinetta", "Choc Valencia"],
  ["Rinetta", "Ashen Suede"],
  ["Rinetta", "Espresso Suede"],
  ["Ripley", "Black Vintage"],
  ["Sakai", "Tan Capretto"],
  ["Samar", "Cemento Suede"],
  ["Sass", "Gold Nappa Metallic"],
  ["Sicily", "Steel Suede"],
  ["Sicily", "Vino Anguille"],
  ["Sicily", "Ashen Suede"],
  ["Sicily", "Tan Python"],
  ["Sicily", "Tomato Nubuck"],
  ["Sophie", "Espresso Suede"],
  ["Sophie", "Steel Suede"],
  ["Swift", "Blush Nubuck"],
  ["Swish", "Espresso Suede"],
  ["Swish", "Black Suede"],
  ["Tiffany", "Espresso Suede"],
  ["Tiffany", "Taupe Suede"],
  ["Timmins", "Cognac Wax"],
  ["Timmins", "Vanilla Vintage"],
  ["Timmins", "Whiskey Wax"],
  ["Topaz", "Choc Croc"],
  ["Topaz", "Wheat Suede"],
  ["Topaz", "Ecru Snake"],
  ["Topaz", "Denim Python"],
  ["Vin", "Espresso Nubuck"],
  ["Vin", "Wheat Nubuck"],
  ["Vin", "Steel Nubuck"],
  ["Vin", "Black Nubuck"],
  ["Violet", "Limon Nubuck"],
  ["Vixen", "Espresso Nubuck"],
  ["Vixen", "Black Nubuck"],
  ["Vixen", "Olive Nubuck"],
  ["Zac", "Choc Croc"],
  ["Zac", "Black Anguille"],
  ["Zephyr", "Black Hi Shine"],
  ["Zoe", "Black Suede"],
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);

let inserted = 0;
let skipped = 0;
const errors = [];

for (const [style, colourLeather] of entries) {
  const styleUpper = style.toUpperCase();
  const { colour, leather } = parseColourLeather(colourLeather);

  try {
    await conn.execute(
      `INSERT IGNORE INTO cancelled_skus (style, colour, leather) VALUES (?, ?, ?)`,
      [styleUpper, colour, leather]
    );
    inserted++;
  } catch (e) {
    errors.push({ style: styleUpper, colour, leather, error: e.message });
    skipped++;
  }
}

await conn.end();

console.log(`Done. Inserted: ${inserted}, Skipped/errors: ${skipped}`);
if (errors.length > 0) {
  console.log('Errors:', JSON.stringify(errors, null, 2));
}

// Show a sample of what was parsed
console.log('\nSample parsed entries:');
for (const [style, colourLeather] of entries.slice(0, 10)) {
  const { colour, leather } = parseColourLeather(colourLeather);
  console.log(`  ${style.toUpperCase()} | ${colour} | ${leather}`);
}
