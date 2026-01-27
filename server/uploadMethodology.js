import fs from "fs";
import path from "path";
import https from "https";

// ---------------- CONFIG ----------------
const dataDir = path.resolve("src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

// GitHub repo info
const repoOwner = "aravindhangesain";
const repoName = "scorecard_cms";
const branch = "main";
const filePathInRepo = "src/data/methodology.json";
const GITHUB_TOKEN = "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"; // your token

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

// ---------- HELPER: GitHub API Request ----------
function githubRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = "";
      res.on("data", chunk => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`GitHub API Error: ${res.statusCode} ${body}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ---------- MAIN FUNCTION ----------
async function updateMethodology() {
  try {
    // 1. Ensure active file exists
    if (!fs.existsSync(activeFile)) {
      console.error("❌ methodology.json not found in src/data");
      process.exit(1);
    }

    // 2. Archive current active file
    const files = fs.readdirSync(dataDir);
    const versionedFiles = files
      .map(f => f.match(/methodology\.v(\d+)\.json/))
      .filter(Boolean)
      .map(m => Number(m[1]));

    const nextVersion = versionedFiles.length ? Math.max(...versionedFiles) + 1 : 1;
    const archiveFile = path.join(dataDir, `methodology.v${nextVersion}.json`);
    fs.copyFileSync(activeFile, archiveFile);
    console.log(`✅ Archived: methodology.v${nextVersion}.json`);

    // 3. (Optional) Validate new file against previous version
    const previousFile =
      versionedFiles.length > 0
        ? path.join(dataDir, `methodology.v${Math.max(...versionedFiles)}.json`)
        : null;

    if (previousFile && fs.existsSync(previousFile)) {
      const oldData = JSON.parse(fs.readFileSync(previousFile, "utf-8"));
      const newData = JSON.parse(fs.readFileSync(activeFile, "utf-8")); // use your current file
      validateJson(oldData, newData);
    }

    // 4. Push updated file to GitHub
    const content = fs.readFileSync(activeFile, "utf-8");
    const base64Content = Buffer.from(content).toString("base64");

    // Get current file SHA
    const getOptions = {
      hostname: "api.github.com",
      path: `/repos/${repoOwner}/${repoName}/contents/${filePathInRepo}?ref=${branch}`,
      method: "GET",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "Node.js",
        Accept: "application/vnd.github.v3+json",
      },
    };

    const fileData = await githubRequest(getOptions);
    const sha = fileData.sha;

    // Update file
    const putOptions = {
      hostname: "api.github.com",
      path: `/repos/${repoOwner}/${repoName}/contents/${filePathInRepo}`,
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "User-Agent": "Node.js",
        Accept: "application/vnd.github.v3+json",
      },
    };

    const bodyData = {
      message: `Update methodology.json via script`,
      content: base64Content,
      sha: sha,
      branch: branch,
    };

    const result = await githubRequest(putOptions, bodyData);
    console.log("✅ File updated on GitHub:", result.content.html_url);
  } catch (err) {
    console.error("❌ Failed to update:", err.message);
  }
}

// Run the update
updateMethodology();
