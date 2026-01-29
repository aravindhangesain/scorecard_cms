from flask import Flask, request, jsonify
import os
import json
import shutil
import re
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
# ---------------- CONFIG ----------------
# For deployment, uncomment below and comment out local testing

# DATA_DIR = "/var/www/astro-test/scorecard_cms/src/data"
# ACTIVE_FILE = os.path.join(DATA_DIR, "methodology.json")
# TEMP_FILE = os.path.join(DATA_DIR, "methodology.new.json")

# For local testing, uncomment below and comment above

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "src", "data")

ACTIVE_FILE = os.path.join(DATA_DIR, "methodology.json")
TEMP_FILE = os.path.join(DATA_DIR, "methodology.new.json")


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


# ------------- UPLOAD ENDPOINT -------------
@app.route("/api/upload-methodology", methods=["POST"])
def upload_json():

    # 0️⃣ Basic upload validation
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not file.filename.endswith(".json"):
        return jsonify({"error": "Only JSON files allowed"}), 400

    os.makedirs(DATA_DIR, exist_ok=True)

    # 1️⃣ Ensure active file exists
    if not os.path.exists(ACTIVE_FILE):
        return jsonify({"error": "methodology.json not found"}), 400

    # 2️⃣ Save uploaded file as temp file
    file.save(TEMP_FILE)

    try:
        # 3️⃣ Find latest archived version
        version_files = [
            f for f in os.listdir(DATA_DIR)
            if re.match(r"methodology\.v\d+\.json", f)
        ]

        latest_version = (
            max(int(re.search(r"\d+", f).group()) for f in version_files)
            if version_files else 0
        )


        # 4️⃣ Determine previous data file
        previous_file = (
            os.path.join(DATA_DIR, f"methodology.v{latest_version}.json")
            if latest_version > 0
            else ACTIVE_FILE
        )

        # 5️⃣ Load old & new JSON
        with open(previous_file, "r", encoding="utf-8") as f:
            old_data = json.load(f)

        with open(TEMP_FILE, "r", encoding="utf-8") as f:
            new_data = json.load(f)

        # 6️⃣ Validate
        validate_json(old_data, new_data)

    except Exception as e:
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)

        return jsonify({
            "error": "Update blocked",
            "message": str(e)
        }), 400

    # 7️⃣ Archive current active file
    next_version = latest_version + 1
    archive_file = os.path.join(
        DATA_DIR, f"methodology.v{next_version}.json"
    )

    shutil.copyfile(ACTIVE_FILE, archive_file)

    # 8️⃣ Activate new file (atomic replace)
    os.replace(TEMP_FILE, ACTIVE_FILE)

    return jsonify({
        "message": "methodology.json updated successfully",
        "archived": f"methodology.v{next_version}.json"
    }), 200

# ------------- GET ENDPOINT -------------
@app.route("/get-json", methods=["GET"])
def get_json():
    if not os.path.exists(ACTIVE_FILE):
        return jsonify({"error": "methodology.json not found"}), 404

    try:
        with open(ACTIVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": "Failed to read file", "message": str(e)}), 500


# ------------- ENTRY POINT -------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
