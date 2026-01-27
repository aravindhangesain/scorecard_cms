const fs = require("fs");
const path = require("path");

const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

// ---------- VALIDATION FUNCTION ----------
function validateJson(oldData, newData) {
  const requiredPaths = [
    "hero.title",
    "hero.description",
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

    if (oldVal !== undefined && (newVal === undefined || newVal === "")) {
      throw new Error(`Missing required field: ${pathKey}`);
    }
  }
}

// 1. Ensure file exists
if (!fs.existsSync(activeFile)) {
  console.error("methodology.json not found");
  process.exit(1);
}

// 2. Copy new file for validation
fs.copyFileSync(activeFile, tempNewFile);

try {
  const oldVersions = fs
    .readdirSync(dataDir)
    .filter(f => f.match(/methodology\.v\d+\.json/));

  const latestVersion = oldVersions.length
    ? Math.max(...oldVersions.map(v => Number(v.match(/\d+/)[0])))
    : 0;

  const previousFile =
    latestVersion > 0
      ? path.join(dataDir, `methodology.v${latestVersion}.json`)
      : null;

  if (previousFile && fs.existsSync(previousFile)) {
    const oldData = JSON.parse(fs.readFileSync(previousFile, "utf-8"));
    const newData = JSON.parse(fs.readFileSync(tempNewFile, "utf-8"));
    validateJson(oldData, newData);
  }
} catch (err) {
  console.error("Update blocked:", err.message);
  fs.unlinkSync(tempNewFile);
  process.exit(1);
}

// 3. Archive current active file
const files = fs.readdirSync(dataDir);
const versions = files
  .map(f => f.match(/methodology\.v(\d+)\.json/))
  .filter(Boolean)
  .map(m => Number(m[1]));

const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

const archiveFile = path.join(dataDir, `methodology.v${nextVersion}.json`);
fs.copyFileSync(activeFile, archiveFile);
console.log(`Archived: methodology.v${nextVersion}.json`);

// 4. Activate new file
fs.renameSync(tempNewFile, activeFile);

console.log("methodology.json updated successfully");
