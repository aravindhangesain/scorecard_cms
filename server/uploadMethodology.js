import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";


const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());

// ---- PATHS ----
const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

// ---- MULTER (memory upload) ----
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_, file, cb) => {
    file.mimetype === "application/json"
      ? cb(null, true)
      : cb(new Error("Only JSON files allowed"));
  }
});

// ---------- VALIDATION ----------
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

// ---------- API ----------
app.post("/upload-methodology", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Parse uploaded JSON
    const newData = JSON.parse(req.file.buffer.toString("utf-8"));

    // Write temp file
    fs.writeFileSync(tempNewFile, JSON.stringify(newData, null, 2));

    // Validation against last version
    const oldVersions = fs
      .readdirSync(dataDir)
      .filter(f => f.match(/methodology\.v\d+\.json/));

    const latestVersion = oldVersions.length
      ? Math.max(...oldVersions.map(v => Number(v.match(/\d+/)[0])))
      : 0;

    if (latestVersion > 0) {
      const prevFile = path.join(dataDir, `methodology.v${latestVersion}.json`);
      const oldData = JSON.parse(fs.readFileSync(prevFile, "utf-8"));
      validateJson(oldData, newData);
    }

    // Archive current file
    const versions = oldVersions.map(v => Number(v.match(/\d+/)[0]));
    const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;

    fs.copyFileSync(
      activeFile,
      path.join(dataDir, `methodology.v${nextVersion}.json`)
    );

    // Activate new file
    fs.renameSync(tempNewFile, activeFile);

    return res.json({
      success: true,
      message: "methodology.json updated",
      version: nextVersion
    });

  } catch (err) {
    if (fs.existsSync(tempNewFile)) fs.unlinkSync(tempNewFile);
    return res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`Uploader running on http://localhost:${PORT}`)
);
