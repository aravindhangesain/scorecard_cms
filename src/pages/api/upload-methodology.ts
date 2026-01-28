import type { APIRoute } from "astro";
import fs from "fs";
import path from "path";

/* ---------- PATHS ---------- */
const dataDir = path.resolve(process.cwd(), "src/data");
const activeFile = path.join(dataDir, "methodology.json");
const tempNewFile = path.join(dataDir, "methodology.new.json");

/* ---------- VALIDATION FUNCTION ---------- */
function validateJson(oldData: any, newData: any) {
  const requiredPaths = [
    "hero.title",
    "hero.description",
    "hero.backgroundImage.src",
    "hero.backgroundImage.alt",
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

export const POST: APIRoute = async ({ request }) => {
  try {
    /* ---------- READ UPLOADED FILE ---------- */
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "No file uploaded" }),
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const newData = JSON.parse(buffer.toString());

    /* ---------- ENSURE DATA DIR ---------- */
    fs.mkdirSync(dataDir, { recursive: true });

    /* ---------- WRITE TEMP FILE ---------- */
    fs.writeFileSync(tempNewFile, JSON.stringify(newData, null, 2));

    /* ---------- VALIDATION ---------- */
    if (fs.existsSync(activeFile)) {
      const versions = fs
        .readdirSync(dataDir)
        .map((f) => f.match(/methodology\.v(\d+)\.json/))
        .filter(Boolean)
        .map((m) => Number(m![1]));

      const latestVersion = versions.length ? Math.max(...versions) : 0;

      const previousFile =
        latestVersion > 0
          ? path.join(dataDir, `methodology.v${latestVersion}.json`)
          : activeFile;

      if (fs.existsSync(previousFile)) {
        const oldData = JSON.parse(
          fs.readFileSync(previousFile, "utf-8")
        );
        validateJson(oldData, newData);
      }
    }

    /* ---------- ARCHIVE CURRENT ---------- */
    if (fs.existsSync(activeFile)) {
      const versions = fs
        .readdirSync(dataDir)
        .map((f) => f.match(/methodology\.v(\d+)\.json/))
        .filter(Boolean)
        .map((m) => Number(m![1]));

      const nextVersion = versions.length ? Math.max(...versions) + 1 : 1;
      const archiveFile = path.join(
        dataDir,
        `methodology.v${nextVersion}.json`
      );

      fs.copyFileSync(activeFile, archiveFile);
    }

    /* ---------- ACTIVATE NEW ---------- */
    fs.renameSync(tempNewFile, activeFile);

    return new Response(
      JSON.stringify({
        success: true,
        version: "updated",
      }),
      { status: 200 }
    );
  } catch (err: any) {
    /* ---------- CLEANUP ---------- */
    if (fs.existsSync(tempNewFile)) {
      fs.unlinkSync(tempNewFile);
    }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400 }
    );
  }
};
