# Feliponetica Speaking

A standalone Flask-based phase game that reads Excel content automatically.

## Quick start

1. Install dependencies:
   `python -m pip install -r requirements.txt`
2. Put your workbook at `data/data.xlsx` (or set `FP_EXCEL_PATH` in `config.py`).
3. Run the app:
   `python run.py`
4. Open `http://localhost:5000/fp-game/`

## Running tests

`python -m pytest -q`

## File layout

- `run.py` — app entry point.
- `config.py` — runtime config.
- `app/__init__.py` — Flask app factory.
- `app/blueprint.py` — blueprint routes.
- `app/data_layer.py` — Excel parsing and payload building.
- `app/video_utils.py` — video URL conversion.
- `app/static/...` — CSS and JavaScript.
- `app/templates/fp_game/index.html` — HTML shell.
- `tests/test_data_layer.py` — workbook validation tests.

## Excel content format

### `ranges` worksheet

Use columns such as:

- `table`
- `phase`
- `set id range`
- `sequence`
- `video URL`

Example:

| table | phase | set id range | sequence | video URL |
| --- | ---: | --- | --- | --- |
| unit1 | 1 | 1-3 | in order | https://www.youtube.com/watch?v=abc123 |

### Content worksheets

Each worksheet corresponds to a table name. Each row is a card, and the `set id` column identifies the card. Group columns follow this pattern:

- `spanish text`, `audio`, `image`
- `spanish text2`, `audio2`, `image2`
- `spanish text3`, `audio3`, `image3`
- `feliponetica1`, `feliponetica2`, `feliponetica3`

The parser automatically builds the primary and secondary sections from populated groups and ignores empty values.
When an audio button is pressed, its matching `feliponeticaN` value appears below the button and stays visible until the card changes.

## Graceful degradation behaviors

- Missing workbook: the app returns a friendly error screen with a retry button.
- Broken audio: clicking a button marks it as played even if the media fails. This prevents users from getting stuck on a missing or broken file.
- Invalid video URLs: the app skips the video and shows cards directly.
- Invalid `ranges` rows are reported in `/api/health` while valid rows continue working.

## Later integration

The app is designed around a Flask factory:

```python
from app import create_app
app = create_app()
```

The Blueprint is registered using `FP_URL_PREFIX` and can be mounted on another Flask app without changing the game code.
