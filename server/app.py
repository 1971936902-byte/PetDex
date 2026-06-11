import json
import os
import sqlite3
import time
import uuid
import zipfile
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory
from werkzeug.utils import secure_filename

from services.local_ai_model import LocalPetModel


ROOT = Path(__file__).resolve().parents[1]
STORAGE = ROOT / "storage"
UPLOADS = STORAGE / "uploads"
GENERATED = STORAGE / "generated"
DB_PATH = STORAGE / "petdex.sqlite3"
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

for folder in (STORAGE, UPLOADS, GENERATED):
    folder.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(ROOT), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024
model = LocalPetModel(GENERATED)


def now_ms():
    return int(time.time() * 1000)


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with connect_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS pet_jobs (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              pet_name TEXT NOT NULL,
              description TEXT,
              source_image_url TEXT,
              status TEXT NOT NULL,
              candidates_json TEXT NOT NULL DEFAULT '[]',
              selected_candidate_url TEXT,
              selected_candidate_id TEXT,
              tier TEXT,
              pet_code TEXT,
              petpack_url TEXT,
              actions_json TEXT NOT NULL DEFAULT '{}',
              features_json TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              job_id TEXT,
              sku TEXT NOT NULL,
              amount REAL NOT NULL,
              status TEXT NOT NULL,
              payment_provider TEXT,
              provider_payment_id TEXT,
              created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              action TEXT NOT NULL,
              entity_id TEXT,
              payload_json TEXT NOT NULL DEFAULT '{}',
              created_at INTEGER NOT NULL
            );
            """
        )


init_db()


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "file_too_large", "message": "图片超过 8MB，请压缩后再上传"}), 413


def public_storage_url(path):
    rel = Path(path).resolve().relative_to(STORAGE.resolve())
    return "/storage/" + str(rel).replace("\\", "/")


def row_to_job(row):
    if row is None:
        return None
    return {
        "id": row["id"],
        "userId": row["user_id"],
        "petName": row["pet_name"],
        "description": row["description"],
        "sourceImageUrl": row["source_image_url"],
        "status": row["status"],
        "candidates": json.loads(row["candidates_json"] or "[]"),
        "selectedCandidateUrl": row["selected_candidate_url"],
        "selectedCandidateId": row["selected_candidate_id"],
        "tier": row["tier"],
        "petCode": row["pet_code"],
        "petpackUrl": row["petpack_url"],
        "actions": json.loads(row["actions_json"] or "{}"),
        "features": json.loads(row["features_json"] or "{}"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def log_action(action, entity_id=None, payload=None):
    with connect_db() as conn:
        conn.execute(
            "INSERT INTO audit_logs(action, entity_id, payload_json, created_at) VALUES(?,?,?,?)",
            (action, entity_id, json.dumps(payload or {}, ensure_ascii=False), now_ms()),
        )


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_job(job_id):
    with connect_db() as conn:
        row = conn.execute("SELECT * FROM pet_jobs WHERE id=?", (job_id,)).fetchone()
    return row_to_job(row)


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/src/<path:path>")
def src_files(path):
    return send_from_directory(ROOT / "src", path)


@app.get("/storage/<path:path>")
def storage_files(path):
    return send_from_directory(STORAGE, path)


@app.get("/api/health")
def health():
    return jsonify(
        {
            "ok": True,
            "service": "petdex-backend",
            "model": model.info(),
            "storage": str(STORAGE),
            "time": now_ms(),
        }
    )


@app.post("/api/pet-jobs")
def create_pet_job():
    file = request.files.get("image")
    pet_name = (request.form.get("petName") or "豆包").strip()
    description = (request.form.get("description") or "").strip()
    user_id = request.form.get("userId") or "demo-user"

    if not file or not file.filename:
        return jsonify({"error": "missing_image", "message": "请上传宠物照片"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "unsupported_format", "message": "仅支持 JPG、PNG、WebP"}), 400

    job_id = "job_" + uuid.uuid4().hex[:12]
    safe = secure_filename(file.filename) or "pet.jpg"
    ext = safe.rsplit(".", 1)[-1].lower()
    upload_path = UPLOADS / f"{job_id}.{ext}"
    file.save(upload_path)

    created = now_ms()
    try:
        candidates, features = model.generate_candidates(upload_path, job_id, pet_name)
    except Exception as exc:
        upload_path.unlink(missing_ok=True)
        log_action("generate_candidates_failed", job_id, {"error": str(exc)})
        return jsonify({"error": "invalid_image", "message": "图片无法解析，请上传清晰的 JPG、PNG 或 WebP 宠物照片"}), 400
    status = "candidate_ready"
    source_url = public_storage_url(upload_path)

    with connect_db() as conn:
        conn.execute(
            """
            INSERT INTO pet_jobs(
              id, user_id, pet_name, description, source_image_url, status,
              candidates_json, features_json, created_at, updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?)
            """,
            (
                job_id,
                user_id,
                pet_name,
                description,
                source_url,
                status,
                json.dumps(candidates, ensure_ascii=False),
                json.dumps(features, ensure_ascii=False),
                created,
                created,
            ),
        )
    log_action("create_pet_job", job_id, {"petName": pet_name})
    return jsonify({"job": get_job(job_id)})


@app.get("/api/pet-jobs/<job_id>")
def read_pet_job(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"job": job})


@app.post("/api/pet-jobs/<job_id>/select-candidate")
def select_candidate(job_id):
    data = request.get_json(silent=True) or {}
    candidate_id = data.get("candidateId")
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "not_found"}), 404
    selected = next((c for c in job["candidates"] if c["id"] == candidate_id), None)
    if not selected:
        return jsonify({"error": "candidate_not_found"}), 400
    with connect_db() as conn:
        conn.execute(
            """
            UPDATE pet_jobs
            SET selected_candidate_id=?, selected_candidate_url=?, status=?, updated_at=?
            WHERE id=?
            """,
            (candidate_id, selected["url"], "awaiting_payment", now_ms(), job_id),
        )
    log_action("select_candidate", job_id, {"candidateId": candidate_id})
    return jsonify({"job": get_job(job_id)})


@app.post("/api/orders")
def create_order():
    data = request.get_json(silent=True) or {}
    job_id = data.get("jobId")
    sku = data.get("sku") or "basic"
    amount_map = {"refresh": 1.0, "basic": 9.9, "advanced": 29.9, "custom": 99.0}
    amount = amount_map.get(sku, 9.9)
    if not job_id or not get_job(job_id):
        return jsonify({"error": "job_not_found"}), 404

    with connect_db() as conn:
        existing = conn.execute(
            "SELECT * FROM orders WHERE job_id=? AND sku=? AND status='pending_payment' ORDER BY created_at DESC LIMIT 1",
            (job_id, sku),
        ).fetchone()
        if existing:
            order = dict(existing)
        else:
            order_id = "ord_" + uuid.uuid4().hex[:12]
            created = now_ms()
            conn.execute(
                "INSERT INTO orders(id,user_id,job_id,sku,amount,status,payment_provider,created_at) VALUES(?,?,?,?,?,?,?,?)",
                (order_id, "demo-user", job_id, sku, amount, "pending_payment", "mock_alipay", created),
            )
            order = {
                "id": order_id,
                "user_id": "demo-user",
                "job_id": job_id,
                "sku": sku,
                "amount": amount,
                "status": "pending_payment",
                "payment_provider": "mock_alipay",
                "created_at": created,
            }
        conn.execute("UPDATE pet_jobs SET tier=?, updated_at=? WHERE id=?", (sku, now_ms(), job_id))
    log_action("create_order", order["id"], {"jobId": job_id, "sku": sku})
    return jsonify({"order": normalize_order(order)})


@app.get("/api/orders/<order_id>")
def read_order(order_id):
    with connect_db() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"order": normalize_order(dict(row))})


@app.post("/api/orders/<order_id>/cancel")
def cancel_order(order_id):
    with connect_db() as conn:
        conn.execute("UPDATE orders SET status='cancelled' WHERE id=? AND status='pending_payment'", (order_id,))
    log_action("cancel_order", order_id)
    return read_order(order_id)


@app.post("/api/orders/<order_id>/confirm-mock")
def confirm_order(order_id):
    with connect_db() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
        if not row:
            return jsonify({"error": "not_found"}), 404
        conn.execute(
            "UPDATE orders SET status='paid', provider_payment_id=? WHERE id=?",
            ("mock_" + uuid.uuid4().hex[:10], order_id),
        )
    log_action("confirm_order", order_id)
    return read_order(order_id)


@app.post("/api/pet-jobs/<job_id>/generate-pack")
def generate_pack(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "not_found"}), 404
    if not job["selectedCandidateId"] and job["candidates"]:
        selected = job["candidates"][0]
    else:
        selected = next((c for c in job["candidates"] if c["id"] == job["selectedCandidateId"]), job["candidates"][0])

    upload_path = STORAGE / job["sourceImageUrl"].replace("/storage/", "")
    try:
        actions, manifest_path, petpack_path = model.generate_action_pack(
            upload_path, job_id, job["petName"], selected["id"], job.get("tier") or "basic"
        )
    except Exception as exc:
        log_action("generate_pack_failed", job_id, {"error": str(exc)})
        return jsonify({"error": "pack_generation_failed", "message": "动作资源生成失败，请重试或联系客服"}), 400
    pet_code = "MP-" + uuid.uuid4().hex[:4].upper() + "-" + uuid.uuid4().hex[:4].upper()
    with connect_db() as conn:
        conn.execute(
            """
            UPDATE pet_jobs
            SET status='ready', actions_json=?, pet_code=?, petpack_url=?, updated_at=?
            WHERE id=?
            """,
            (
                json.dumps(actions, ensure_ascii=False),
                pet_code,
                public_storage_url(petpack_path),
                now_ms(),
                job_id,
            ),
        )
    log_action("generate_pack", job_id, {"petCode": pet_code, "manifest": str(manifest_path)})
    try:
        upload_path.unlink(missing_ok=True)
    except Exception:
        pass
    return jsonify({"job": get_job(job_id)})


@app.get("/api/pets")
def list_pets():
    with connect_db() as conn:
        rows = conn.execute("SELECT * FROM pet_jobs ORDER BY created_at DESC LIMIT 30").fetchall()
    return jsonify({"pets": [row_to_job(r) for r in rows]})


@app.get("/api/pets/<job_id>/download")
def download_petpack(job_id):
    job = get_job(job_id)
    if not job or not job.get("petpackUrl"):
        return jsonify({"error": "not_ready"}), 404
    path = STORAGE / job["petpackUrl"].replace("/storage/", "")
    return send_file(path, as_attachment=True, download_name=f"{job['petName'] or 'pet'}.petpack")


def normalize_order(order):
    return {
        "id": order["id"],
        "userId": order.get("user_id"),
        "jobId": order.get("job_id"),
        "sku": order["sku"],
        "amount": order["amount"],
        "status": order["status"],
        "paymentProvider": order.get("payment_provider"),
        "providerPaymentId": order.get("provider_payment_id"),
        "createdAt": order["created_at"],
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8800")))
