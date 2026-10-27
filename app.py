from flask import Flask, jsonify, render_template
import pandas as pd
import os

app = Flask(__name__)

EXCEL_FILE = "data.xlsx"


def load_excel_data():
    df = pd.read_excel(EXCEL_FILE, engine="openpyxl")
    df = df.fillna("")
    return df.to_dict(orient="records")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/data")
def get_data():
    try:
        rows = load_excel_data()

        return jsonify({
            "success": True,
            "rows": rows
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)