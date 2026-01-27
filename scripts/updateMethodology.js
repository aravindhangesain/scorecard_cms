import fs from "fs";
import path from "path";
import https from "https";

// ---------------- CONFIG ----------------
const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

// GitHub raw URL of the new methodology.json
const githubRawUrl = "https://raw.githubusercontent.com/aravindhangesain/scorecard_cms/main/src/data/methodology.json";

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

// ---------- DOWNLOAD JSON FROM GITHUB ----------
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, res => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", err => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

// ---------- MAIN FUNCTION ----------
async function updateMethodology() {
  // 1. Ensure active file exists
  if (!fs.existsSync(activeFile)) {
    console.error("❌ methodology.json not found in src/data");
    process.exit(1);
  }

  try {
    console.log("📥 Downloading new methodology.json from GitHub...");
    await downloadFile(githubRawUrl, tempNewFile);

    // 2. Validate new JSON against previous version
    const files = fs.readdirSync(dataDir);
    const versionedFiles = files
      .map(f => f.match(/methodology\.v(\d+)\.json/))
      .filter(Boolean)
      .map(m => Number(m[1]));

    const latestVersion = versionedFiles.length ? Math.max(...versionedFiles) : 0;
    const previousFile =
      latestVersion > 0
        ? path.join(dataDir, `methodology.v${latestVersion}.json`)
        : null;

    if (previousFile && fs.existsSync(previousFile)) {
      const oldData = JSON.parse(fs.readFileSync(previousFile, "utf-8"));
      const newData = JSON.parse(fs.readFileSync(tempNewFile, "utf-8"));
      validateJson(oldData, newData);
    }

    // 3. Archive current active file
    const nextVersion = latestVersion + 1;
    const archiveFile = path.join(dataDir, `methodology.v${nextVersion}.json`);
    fs.copyFileSync(activeFile, archiveFile);
    console.log(`✅ Archived: methodology.v${nextVersion}.json`);

    // 4. Replace active file (Windows-safe)
    try {
      if (fs.existsSync(activeFile)) {
        fs.unlinkSync(activeFile);
      }
      fs.renameSync(tempNewFile, activeFile);
      console.log("✅ methodology.json updated successfully");
    } catch (err) {
      console.warn(
        "⚠ Rename failed, using copy fallback (Windows EPERM workaround)"
      );
      fs.copyFileSync(tempNewFile, activeFile);
      fs.unlinkSync(tempNewFile);
      console.log("✅ methodology.json updated successfully (via copy fallback)");
    }
  } catch (err) {
    console.error("❌ Update failed:", err.message);
    if (fs.existsSync(tempNewFile)) fs.unlinkSync(tempNewFile);
    process.exit(1);
  }
}

// Run the update
updateMethodology();
