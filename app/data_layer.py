import os
import re
import threading
import time
from collections import defaultdict
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.video_utils import normalize_video_url

_CACHE = {}
_CACHE_LOCK = threading.Lock()


def normalize_header(value):
    if value is None or pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def parse_set_id_range(value):
    if value is None or pd.isna(value):
        return []

    text = str(value).strip()
    if not text:
        return []

    result = []
    for chunk in text.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        match = re.fullmatch(r"(\d+)\s*-\s*(\d+)", chunk)
        if match:
            start, end = int(match.group(1)), int(match.group(2))
            if end < start:
                raise ValueError(f"Invalid range '{chunk}'")
            result.extend(range(start, end + 1))
        else:
            if not re.fullmatch(r"\d+", chunk):
                raise ValueError(f"Invalid set id range '{chunk}'")
            result.append(int(chunk))

    seen = set()
    ordered = []
    for item in result:
        if item not in seen:
            seen.add(item)
            ordered.append(item)
    return sorted(ordered)


def normalize_sequence(value):
    if value is None or pd.isna(value):
        return "in order"
    text = str(value).strip().lower()
    if not text:
        return "in order"
    return "random" if text == "random" else "in order"


def _is_empty_cell(value):
    if value is None or pd.isna(value):
        return True
    return str(value).strip() == ""


def _parse_set_id(value):
    if value is None or pd.isna(value):
        return None
    try:
        numeric_value = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    if not numeric_value.is_finite() or numeric_value != numeric_value.to_integral_value():
        return None
    return int(numeric_value)


def _get_group_columns(row):
    groups = defaultdict(dict)
    for column_name in row.index:
        normalized = normalize_header(column_name)
        if not normalized:
            continue
        match = re.fullmatch(r"(spanish text|audio|image)(\d+)?", normalized)
        if not match:
            continue
        field_name = match.group(1)
        suffix = match.group(2)
        group_index = int(suffix) if suffix else 1
        raw_value = row[column_name]
        groups[group_index][field_name] = raw_value
    ordered = []
    for group_index in sorted(groups):
        group = groups[group_index]
        text_value = group.get("spanish text", "")
        audio_value = group.get("audio", "")
        image_value = group.get("image", "")
        if any(not _is_empty_cell(value) for value in [text_value, audio_value, image_value]):
            ordered.append({
                "text": text_value if not _is_empty_cell(text_value) else "",
                "audio": audio_value if not _is_empty_cell(audio_value) else "",
                "image": image_value if not _is_empty_cell(image_value) else "",
            })
    return ordered


def make_card_payload(row):
    normalized_row = {normalize_header(key): value for key, value in row.items()}
    groups = _get_group_columns(row)
    if not groups:
        return {
            "setId": None,
            "primary": {"text": "", "audio": "", "image": ""},
            "secondary": [],
        }
    primary = groups[0]
    secondary = groups[1:]
    secondary = groups[1:]
    set_id = _parse_set_id(normalized_row.get("set id"))
    return {
        "setId": set_id,
        "primary": primary,
        "secondary": secondary,
    }


def build_payload(excel_path, cache_ttl=5):
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel workbook not found at {excel_path}")

    mtime = os.path.getmtime(excel_path)
    cache_key = f"{excel_path}:{mtime}"
    now = time.monotonic()

    with _CACHE_LOCK:
        cached = _CACHE.get(cache_key)
        if cached and (now - cached["ts"]) < cache_ttl:
            return cached["payload"]

    workbook = pd.ExcelFile(excel_path)
    sheet_names = workbook.sheet_names
    normalized_sheet_names = {normalize_header(name): name for name in sheet_names}
    errors = []
    valid_rows = []
    table_rows = defaultdict(list)

    if "ranges" in normalized_sheet_names:
        try:
            ranges_df = pd.read_excel(excel_path, sheet_name=normalized_sheet_names["ranges"], dtype=str)
        except Exception:
            ranges_df = pd.DataFrame()
    else:
        ranges_df = pd.DataFrame()

    for row_index, row in ranges_df.iterrows():
        row_number = row_index + 2
        row_values = {normalize_header(key): value for key, value in row.to_dict().items()}

        table_name = normalize_header(row_values.get("table", ""))
        if not table_name:
            errors.append(f"Row {row_number}: missing table name")
            continue

        if table_name not in normalized_sheet_names:
            errors.append(f"Row {row_number}: worksheet '{table_name}' does not exist")
            continue

        phase_value = row_values.get("phase")
        try:
            phase_number = int(str(phase_value).strip())
        except (TypeError, ValueError):
            errors.append(f"Row {row_number}: invalid phase value '{phase_value}'")
            continue

        range_value = row_values.get("set id range")
        if range_value is None or pd.isna(range_value) or str(range_value).strip() == "":
            errors.append(f"Row {row_number}: missing set id range")
            continue

        try:
            card_ids = parse_set_id_range(range_value)
        except ValueError as exc:
            errors.append(f"Row {row_number}: {exc}")
            continue

        if not card_ids:
            errors.append(f"Row {row_number}: set id range produced no valid card ids")
            continue

        sequence_value = normalize_sequence(row_values.get("sequence"))
        video_value = row_values.get("video url")
        video_url, video_error = normalize_video_url(video_value)

        key = (table_name, phase_number)
        if key in [(row["table"], row["phase"]) for row in valid_rows]:
            errors.append(f"Row {row_number}: duplicate table/phase pair ({table_name}, {phase_number})")
            continue

        valid_rows.append({
            "table": table_name,
            "phase": phase_number,
            "range": range_value,
            "sequence": sequence_value,
            "videoUrl": video_url,
            "videoError": video_error,
            "row_number": row_number,
        })
        table_rows[table_name].append(valid_rows[-1])

    data_tables = []
    for table_name in sorted(table_rows):
        actual_sheet_name = normalized_sheet_names[table_name]
        content_df = pd.read_excel(excel_path, sheet_name=actual_sheet_name)
        if content_df.empty:
            table_payload = {"name": table_name, "phases": []}
            data_tables.append(table_payload)
            continue

        set_lookup = {}
        for _, row in content_df.iterrows():
            normalized_row = {normalize_header(key): value for key, value in row.items()}
            set_id = _parse_set_id(normalized_row.get("set id"))
            if set_id is None:
                continue
            set_lookup[set_id] = row

        phases = []
        for phase_row in sorted(table_rows[table_name], key=lambda item: item["phase"]):
            phase_number = phase_row["phase"]
            card_ids = parse_set_id_range(phase_row["range"])
            cards = []
            for set_id in sorted(card_ids):
                source_row = set_lookup.get(set_id)
                if source_row is None:
                    continue
                card = make_card_payload(source_row)
                card["setId"] = set_id
                cards.append(card)

            phases.append({
                "phase": phase_number,
                "sequence": phase_row["sequence"],
                "videoUrl": phase_row["videoUrl"],
                "videoError": phase_row["videoError"],
                "cardIds": card_ids,
                "cards": cards,
            })

        data_tables.append({
            "name": table_name,
            "phases": phases,
        })

    payload = {
        "tables": data_tables,
        "errors": errors,
    }

    with _CACHE_LOCK:
        _CACHE[cache_key] = {"ts": now, "payload": payload}

    return payload
