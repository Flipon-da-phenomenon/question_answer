from flask import Blueprint, current_app, jsonify, render_template

from app.data_layer import build_payload

fp_game_bp = Blueprint("fp_game", __name__, template_folder="templates")


@fp_game_bp.route("/")
def index():
    return render_template("fp_game/index.html")


@fp_game_bp.route("/api/tables")
def api_tables():
    excel_path = current_app.config["FP_EXCEL_PATH"]
    try:
        payload = build_payload(excel_path, current_app.config["FP_CACHE_TTL"])
    except FileNotFoundError:
        return jsonify({"error": f"Excel workbook not found at {excel_path}"}), 503
    return jsonify({"tables": payload.get("tables", [])})


@fp_game_bp.route("/api/tables/<table_name>")
def api_table(table_name):
    excel_path = current_app.config["FP_EXCEL_PATH"]
    try:
        payload = build_payload(excel_path, current_app.config["FP_CACHE_TTL"])
    except FileNotFoundError:
        return jsonify({"error": f"Excel workbook not found at {excel_path}"}), 503

    for item in payload.get("tables", []):
        if str(item.get("name", "")).lower() == str(table_name).lower():
            return jsonify(item)
    return jsonify({"error": f"Table '{table_name}' not found."}), 404


@fp_game_bp.route("/api/health")
def api_health():
    excel_path = current_app.config["FP_EXCEL_PATH"]
    try:
        payload = build_payload(excel_path, current_app.config["FP_CACHE_TTL"])
    except FileNotFoundError:
        return jsonify({"ok": False, "errors": [f"Excel workbook not found at {excel_path}"], "tablesFound": 0}), 503

    return jsonify({
        "ok": not bool(payload.get("errors")),
        "errors": payload.get("errors", []),
        "tablesFound": len(payload.get("tables", [])),
    })
