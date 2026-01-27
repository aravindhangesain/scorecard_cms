import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export const POST = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !file.name.endsWith(".json")) {
    return new Response("Invalid file", { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const dataDir = path.resolve("src/data");
  const targetFile = path.join(dataDir, "methodology.json");

  // 1. Save uploaded file
  fs.writeFileSync(targetFile, buffer);

  try {
    // 2. Run CMS validation + versioning
    execSync("node scripts/updateMethodology.js", { stdio: "inherit" });

    // 3. Git commit
    execSync("git add src/data/methodology.json", { stdio: "inherit" });
    execSync(
      `git commit -m "CMS: update methodology content"`,
      { stdio: "inherit" }
    );
    execSync("git push origin main", { stdio: "inherit" });

    return new Response("Upload successful", { status: 200 });
  } catch (err) {
    return new Response("CMS update failed", { status: 500 });
  }
};
