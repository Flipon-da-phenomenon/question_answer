from urllib.parse import parse_qs, urlencode, urlparse


def normalize_video_url(raw_url, allow_youtube=True):
    if raw_url is None:
        return None, "Unsupported video URL"

    text = str(raw_url).strip()
    if not text:
        return None, "Unsupported video URL"

    parsed = urlparse(text)
    lower_host = (parsed.netloc or "").lower()
    lower_path = (parsed.path or "").lower()

    if parsed.scheme in {"http", "https"}:
        if re_match_media(parsed.path):
            return text, None

        if "youtube.com" in lower_host:
            if lower_path.startswith("/watch"):
                query = parse_qs(parsed.query)
                video_id = (query.get("v") or [None])[0]
                if not video_id:
                    return None, "Unsupported video URL"
                embed = f"https://www.youtube.com/embed/{video_id}"
                start_value = (query.get("t") or query.get("start") or [None])[0]
                if start_value:
                    embed = f"{embed}?{urlencode({'start': start_value})}"
                return embed, None

            if lower_path.startswith("/embed/"):
                return text, None

            if lower_path.startswith("/shorts/"):
                tail = parsed.path.split("/shorts/")[-1].split("/")[0]
                if tail:
                    embed = f"https://www.youtube.com/embed/{tail}"
                    params = {}
                    if "t" in parse_qs(parsed.query):
                        params["start"] = parse_qs(parsed.query)["t"][0]
                    if "start" in parse_qs(parsed.query):
                        params["start"] = parse_qs(parsed.query)["start"][0]
                    if params:
                        embed = f"{embed}?{urlencode(params)}"
                    return embed, None

        if "youtu.be" in lower_host:
            tail = parsed.path.strip("/")
            if tail:
                video_id = tail.split("/")[0]
                embed = f"https://www.youtube.com/embed/{video_id}"
                query = parse_qs(parsed.query)
                start_value = (query.get("t") or query.get("start") or [None])[0]
                if start_value:
                    embed = f"{embed}?{urlencode({'start': start_value})}"
                return embed, None

    return None, "Unsupported video URL"


def re_match_media(path):
    return bool(path and __import__("re").search(r"\.(mp4|webm)(?:[?#]|$)", path, __import__("re").I))
