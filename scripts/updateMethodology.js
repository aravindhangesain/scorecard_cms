import fs from "fs";
import path from "path";

const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");
const oldActiveFile = path.join(dataDir, "methodology.active.json");

// ---------- VALIDATION FUNCTION ----------
function validateJson(oldData, newData) {
  const requiredPaths = [
    "hero",
    "hero.title",
    "hero.description",
    "hero.backgroundImage",
    "hero.backgroundImage.src",
    "hero.backgroundImage.alt"
  ];

  for (const pathKey of requiredPaths) {
    const keys = pathKey.split(".");
    let oldVal = oldData;
    let newVal = newData;

    for (const key of keys) {
      oldVal = oldVal?.[key];
      newVal = newVal?.[key];
    }

    // If old has value but new is missing or empty → block update
    if (oldVal !== undefined && (newVal === undefined || newVal === "")) {
      throw new Error(`Missing required field: ${pathKey}`);
    }
  }
}

// 1. Ensure data folder exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 2. Ensure a new methodology.json exists
if (!fs.existsSync(activeFile)) {
  console.error("methodology.json not found in src/data/");
  process.exit(1);
}

// 3. Temporarily rename NEW methodology.json
fs.renameSync(activeFile, tempNewFile);

// ---------- VALIDATION STEP ----------
try {
  if (fs.existsSync(oldActiveFile)) {
    const oldData = JSON.parse(fs.readFileSync(oldActiveFile, "utf-8"));
    const newData = JSON.parse(fs.readFileSync(tempNewFile, "utf-8"));
    validateJson(oldData, newData);
  }
} catch (err) {
  console.error(`Update blocked: ${err.message}`);
  // Restore original file
  fs.renameSync(tempNewFile, activeFile);
  process.exit(1);
}

// 4. Find latest version
const files = fs.readdirSync(dataDir);
const versions = files
  .map(file => {
    const match = file.match(/methodology\.v(\d+)\.json/);
    return match ? Number(match[1]) : null;
  })
  .filter(v => v !== null);

const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

// 5. Archive OLD methodology.json if exists
if (fs.existsSync(oldActiveFile)) {
  const versionedFile = path.join(
    dataDir,
    `methodology.v${nextVersion}.json`
  );
  fs.renameSync(oldActiveFile, versionedFile);
  console.log(`Archived as methodology.v${nextVersion}.json`);
}

// 6. Make NEW file active
fs.renameSync(tempNewFile, activeFile);

// 7. Keep a copy as active reference
fs.copyFileSync(activeFile, oldActiveFile);

console.log("New methodology.json activated");
