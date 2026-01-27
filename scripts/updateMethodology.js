import fs from "fs";
import path from "path";

const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

// ---------- SAFETY CHECK ----------
if (!fs.existsSync(activeFile)) {
  console.error("❌ methodology.json not found");
  process.exit(1);
}

if (!fs.existsSync(tempNewFile)) {
  console.error("❌ methodology.new.json not found");
  console.error("➡️  Nothing to activate");
  process.exit(1);
}

try {
  // ---------- FIND NEXT VERSION ----------
  const versions = fs
    .readdirSync(dataDir)
    .map(f => f.match(/methodology\.v(\d+)\.json/))
    .filter(Boolean)
    .map(m => Number(m[1]));

  const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

  // ---------- ARCHIVE CURRENT ----------
  const archiveFile = path.join(
    dataDir,
    `methodology.v${nextVersion}.json`
  );

  fs.copyFileSync(activeFile, archiveFile);
  console.log(`📦 Archived: methodology.v${nextVersion}.json`);

  // ---------- ACTIVATE NEW ----------
  fs.renameSync(tempNewFile, activeFile);
  console.log("✅ methodology.json updated successfully");

} catch (err) {
  console.error("🚫 Update failed:", err.message);
  process.exit(1);
}
