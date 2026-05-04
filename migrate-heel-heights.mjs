import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS last_heel_heights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      last_name VARCHAR(128) NOT NULL,
      heel_height_cm FLOAT NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY last_heel_heights_last_name_unique (last_name)
    )
  `);
  console.log("Created last_heel_heights table");

  // Seed with scraped data
  const heelHeights = {
    "ANJA": 10.5, "ANNABELLE": 6.5, "AVANTI": 8.5, "BERTIE": 7.5, "BETTI": 8.0,
    "CAPRICE": 7.0, "CHARLIE/PENNY": 3.5, "CLEO": 8.5, "CLEO/CORSO": 8.5,
    "DELTA/ALLURE": 6.0, "DIAMOND": 9.5, "DRAMA": 6.0, "EDGY": 5.0,
    "FARRAH": 9.5, "FIFI": 10.0, "FLORIDA": 5.5, "GOLDIE": 10.0,
    "HALLIE": 7.5, "JUNIPER": 6.5, "KIMBA": 1.0, "KIRA": 4.5,
    "KOMMA/KEIKI": 11.0, "KRUZ": 5.0, "LILA": 10.0, "LOTUS": 10.5,
    "MARLEY": 10.5, "MINOGUE/MILLER": 8.5, "MUSTANG": 8.5, "NIKI": 9.5,
    "PARIS": 8.5, "PORSHA": 9.5, "RANCHER": 6.0, "RUMA": 6.5,
    "SANDRA": 10.5, "SHIRLEY": 8.0, "SKYE": 11.0, "SWIFT": 6.5,
    "SWISH": 10.0, "TAYLOR": 5.0, "TROPIC": 3.5, "VANITY": 13.0,
    "VICTORIA": 10.0
  };

  let inserted = 0;
  for (const [lastName, height] of Object.entries(heelHeights)) {
    await conn.execute(
      `INSERT INTO last_heel_heights (last_name, heel_height_cm) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE heel_height_cm = VALUES(heel_height_cm)`,
      [lastName, height]
    );
    inserted++;
  }
  console.log(`Seeded ${inserted} heel height records`);
} finally {
  await conn.end();
}
