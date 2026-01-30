from flask import Flask, request, jsonify
import os
import json
import shutil
import re
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
print("### THIS APP.PY IS LOADED ###")

# ---------------- CONFIG (PRODUCTION) ----------------
# Store uploaded JSON OUTSIDE git repo so cron/git reset won't wipe it
UPLOAD_DIR = "/var/www/astro-test/uploads"
ARCHIVE_DIR = os.path.join(UPLOAD_DIR, "archive")

ACTIVE_FILE = os.path.join(UPLOAD_DIR, "methodology.json")
TEMP_FILE = os.path.join(UPLOAD_DIR, "methodology.new.json")

# Ensure folders exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(ARCHIVE_DIR, exist_ok=True)


# ---------- VALIDATION FUNCTION ----------
def validate_json(old_data, new_data):
    required_paths = [
        "hero.title",
        "hero.description",
        "hero.backgroundImage.src",
        "hero.backgroundImage.alt"
    ]

    for path_key in required_paths:
        keys = path_key.split(".")
        old_val = old_data
        new_val = new_data

        for key in keys:
            old_val = old_val.get(key) if isinstance(old_val, dict) else None
            new_val = new_val.get(key) if isinstance(new_val, dict) else None

        # If field existed before, it must exist now
        if old_val is not None and (new_val is None or new_val == ""):
            raise ValueError(f"Missing required field: {path_key}")

@app.route("/__routes", methods=["GET"])
def list_routes():
    return {
        "routes": [str(r) for r in app.url_map.iter_rules()]
    }

# ------------- UPLOAD ENDPOINT -------------
@app.route("/api/upload-methodology", methods=["POST"])
def upload_json():

    # 0) Basic upload validation
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not file.filename.endswith(".json"):
        return jsonify({"error": "Only JSON files allowed"}), 400

    # 1) Ensure active file exists (first-time bootstrap required)
    if not os.path.exists(ACTIVE_FILE):
        return jsonify({
            "error": "methodology.json not found in uploads folder",
            "message": f"Expected at: {ACTIVE_FILE}"
        }), 400

    # 2) Save uploaded file as temp file
    file.save(TEMP_FILE)

    try:
        # 3) Find latest archived version from ARCHIVE_DIR
        version_files = [
            f for f in os.listdir(ARCHIVE_DIR)
            if re.match(r"methodology\.v\d+\.json", f)
        ]

        latest_version = (
            max(int(re.search(r"\d+", f).group()) for f in version_files)
            if version_files else 0
        )

        # 4) Determine previous data file
        previous_file = (
            os.path.join(ARCHIVE_DIR, f"methodology.v{latest_version}.json")
            if latest_version > 0
            else ACTIVE_FILE
        )

        # 5) Load old & new JSON
        with open(previous_file, "r", encoding="utf-8") as f:
            old_data = json.load(f)

        with open(TEMP_FILE, "r", encoding="utf-8") as f:
            new_data = json.load(f)

        # 6) Validate
        validate_json(old_data, new_data)

    except Exception as e:
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)

        return jsonify({
            "error": "Update blocked",
            "message": str(e)
        }), 400

    # 7) Archive current active file
    next_version = latest_version + 1
    archive_file = os.path.join(ARCHIVE_DIR, f"methodology.v{next_version}.json")
    shutil.copyfile(ACTIVE_FILE, archive_file)

    # 8) Activate new file (atomic replace)
    os.replace(TEMP_FILE, ACTIVE_FILE)

    return jsonify({
        "message": "methodology.json updated successfully",
        "archived": f"methodology.v{next_version}.json",
        "active_path": ACTIVE_FILE
    }), 200


# ------------- ENTRY POINT -------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
