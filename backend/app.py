from flask import Flask, request, jsonify
import os
import json
import shutil
import re
import pandas as pd
import math
import csv
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
    
# ---------------- PATHS ----------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")

UPLOAD_DIR = "/var/www/astro-test/uploads"
ARCHIVE_DIR = os.path.join(UPLOAD_DIR, "archive")

ACTIVE_FILE = os.path.join(UPLOAD_DIR, "top-perfomers.json")
TEMP_FILE = os.path.join(UPLOAD_DIR, "top-perfomers.tmp")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(ARCHIVE_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------- HEADER MAP ----------------
HEADER_MAP = {
    "Manufacturer": "manufacturer",
    "Model type": "model",
    "TC": "tc",
    "DH": "dh",
    "MSS": "mss",
    "HSS": "hss",
    "PID": "pid",
    "LID+LETID": "lid",
    "PAN": "pan",
    "Module Design": "moduleDesign",
    "Cell Technology": "cellTech",
    "Power Class Range": "powerRange",
    "Wafer Size": "waferSize",
    "Factory Location": "factory",
    "BOM ID": "bomId",
}

# ---------------- VERSIONING ----------------
def get_latest_version():
    if not os.path.exists(ARCHIVE_DIR):
        return 0

    versions = [
        int(re.search(r"\d+", f).group())
        for f in os.listdir(ARCHIVE_DIR)
        if re.match(r"top-perfomers\.v\d+\.json", f)
    ]
    return max(versions) if versions else 0

# ---------------- NORMALIZE VALUE ----------------
def normalize_value(val):
    if val is None:
        return ""

    if isinstance(val, str):
        val = val.strip()

        if val.lower() == "x":
            return "✓"

        if val.replace(".", "", 1).isdigit():
            return float(val)

        return val

    if isinstance(val, (int, float)):
        return float(val)

    return str(val)

# ---------------- CSV PARSER ----------------
def parse_csv(path):
    print(" CSV PARSER ACTIVE ")

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))

    if len(rows) < 3:
        raise ValueError("Invalid CSV format")

    headers_raw = rows[1]
    headers = [HEADER_MAP.get(h.strip(), None) for h in headers_raw]

    data = []

    for row in rows[2:]:
        if not any(row):
            continue

        obj = {}
        for i, key in enumerate(headers):
            if not key:
                continue
            val = row[i] if i < len(row) else ""
            obj[key] = normalize_value(val)

        if obj:
            data.append(obj)

    return data

# ---------------- EXCEL PARSER ----------------
def parse_excel(path):
    print(" EXCEL PARSER ACTIVE ")

    df = pd.read_excel(path, skiprows=1)  # skip export note row
    df.columns = [c.strip() if isinstance(c, str) else "" for c in df.columns]

    data = []

    for _, r in df.iterrows():
        obj = {}

        for col in df.columns:
            key = HEADER_MAP.get(col)
            if not key:
                continue

            obj[key] = normalize_value(r[col])

        if obj:
            data.append(obj)

    return data

# ---------------- API ----------------
@app.route("/api/upload-top-perfomers", methods=["POST"])
def upload_top_performers():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    filename = file.filename.lower()

    if not filename.endswith((".csv", ".xlsx")):
        return jsonify({"error": "Only CSV or Excel allowed"}), 400

    file.save(TEMP_FILE)

    try:
        if filename.endswith(".csv"):
            new_data = parse_csv(TEMP_FILE)
        else:
            new_data = parse_excel(TEMP_FILE)

        if not new_data:
            raise ValueError("No valid data rows found")

        print("FIRST ROW:", new_data[0])

        latest_version = get_latest_version()

        if os.path.exists(ACTIVE_FILE):
            next_version = latest_version + 1
            shutil.copyfile(
                ACTIVE_FILE,
                os.path.join(ARCHIVE_DIR, f"top-perfomers.v{next_version}.json")
            )
        else:
            next_version = 0

        print("WRITING JSON TO:", ACTIVE_FILE)
        with open(ACTIVE_FILE, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)

    except Exception as e:
        print("ERROR:", repr(e))
        return jsonify({"error": str(e)}), 400

    finally:
        if os.path.exists(TEMP_FILE):
            os.remove(TEMP_FILE)

    return jsonify({
        "message": "top-perfomers.json updated successfully",
        "records": len(new_data),
        "archived": f"top-perfomers.v{next_version}.json" if next_version else None
    }), 200



# ------------- ENTRY POINT -------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
