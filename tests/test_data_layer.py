import os

from openpyxl import Workbook

from app.data_layer import build_payload


def _make_workbook(path, ranges_rows, sheets):
    wb = Workbook()
    default = wb.active
    default.title = 'ranges'
    ws = wb['ranges']
    for row in ranges_rows:
        ws.append(row)

    for sheet_name, rows in sheets.items():
        new_sheet = wb.create_sheet(sheet_name)
        for row in rows:
            new_sheet.append(row)

    wb.save(path)


def test_build_payload_valid_table(tmp_path):
    excel_path = tmp_path / 'valid.xlsx'
    _make_workbook(
        excel_path,
        [
            ['table', 'phase', 'set id range', 'sequence', 'video URL'],
            ['unit1', 1, '1-2', 'in order', 'https://www.youtube.com/watch?v=abc123'],
        ],
        {
            'unit1': [
                ['set id', 'spanish text', 'audio1', 'image1'],
                [1, 'hola', 'https://example.com/audio1.mp3', 'https://example.com/one.png'],
                [2, 'adios', 'https://example.com/audio2.mp3', 'https://example.com/two.png'],
            ]
        },
    )

    payload = build_payload(str(excel_path), cache_ttl=1)
    assert payload['errors'] == []
    assert payload['tables'][0]['name'] == 'unit1'
    assert payload['tables'][0]['phases'][0]['cardIds'] == [1, 2]
    assert payload['tables'][0]['phases'][0]['cards'][0]['primary']['text'] == 'hola'


def test_float_set_ids_and_sparse_dynamic_groups_load_cards(tmp_path):
    excel_path = tmp_path / 'float-ids.xlsx'
    audio_url = 'https://example.com/audio.mp3'
    image_url = 'https://example.com/image.png'
    _make_workbook(
        excel_path,
        [
            ['table', 'phase', 'set id range', 'sequence', 'video URL'],
            ['unit1', 1, '1-3', 'in order', ''],
        ],
        {
            'unit1': [
                [
                    'set id', 'spanish text', 'audio', 'image',
                    'spanish text2', 'audio2', 'image2',
                    'spanish text7', 'audio7', 'image7',
                ],
                [1.0, None, None, None, None, audio_url, None, 'hola', None, image_url],
                [2.0, 'adios', None, image_url, None, None, None, None, audio_url, None],
                [3.5, 'not a card', None, None, None, None, None, None, None, None],
            ]
        },
    )

    payload = build_payload(str(excel_path), cache_ttl=1)
    phase = payload['tables'][0]['phases'][0]

    assert phase['cardIds'] == [1, 2, 3]
    assert [card['setId'] for card in phase['cards']] == [1, 2]
    assert phase['cards'][0]['primary'] == {'text': '', 'audio': audio_url, 'image': '', 'feliponetica': ''}
    assert phase['cards'][0]['secondary'] == [
        {'text': 'hola', 'audio': '', 'image': image_url, 'feliponetica': ''},
    ]
    assert phase['cards'][1]['primary'] == {'text': 'adios', 'audio': '', 'image': image_url, 'feliponetica': ''}
    assert phase['cards'][1]['secondary'] == [
        {'text': '', 'audio': audio_url, 'image': '', 'feliponetica': ''},
    ]


def test_feliponetica_columns_stay_matched_to_sparse_group_suffixes(tmp_path):
    excel_path = tmp_path / 'feliponetica.xlsx'
    _make_workbook(
        excel_path,
        [
            ['table', 'phase', 'set id range', 'sequence', 'video URL'],
            ['unit1', 1, '1', 'in order', ''],
        ],
        {
            'unit1': [
                [
                    'set id', 'spanish text', 'audio', 'image', 'feliponetica1',
                    'audio2', 'feliponetica2', 'audio4', 'feliponetica4',
                ],
                [
                    1, 'hola', 'https://example.com/audio1.mp3', '', 'phonetic one',
                    'https://example.com/audio2.mp3', 'phonetic two',
                    'https://example.com/audio4.mp3', 'phonetic four',
                ],
            ]
        },
    )

    payload = build_payload(str(excel_path), cache_ttl=1)
    card = payload['tables'][0]['phases'][0]['cards'][0]

    assert card['primary']['feliponetica'] == 'phonetic one'
    assert [group['feliponetica'] for group in card['secondary']] == [
        'phonetic two',
        'phonetic four',
    ]


def test_invalid_rows_are_reported_without_blocking_valid_tables(tmp_path):
    excel_path = tmp_path / 'mixed.xlsx'
    _make_workbook(
        excel_path,
        [
            ['table', 'phase', 'set id range', 'sequence', 'video URL'],
            ['unit1', 1, '1-2', 'in order', ''],
            ['missing_table', 2, '1', 'in order', ''],
            ['unit1', 1, '3', 'in order', ''],
        ],
        {
            'unit1': [
                ['set id', 'spanish text', 'audio1', 'image1'],
                [1, 'uno', 'https://example.com/uno.mp3', 'https://example.com/u.png'],
                [2, 'dos', 'https://example.com/dos.mp3', 'https://example.com/d.png'],
                [3, 'tres', 'https://example.com/tres.mp3', 'https://example.com/t.png'],
            ]
        },
    )

    payload = build_payload(str(excel_path), cache_ttl=1)
    assert any('missing_table' in error for error in payload['errors'])
    assert any('duplicate' in error.lower() for error in payload['errors'])
    assert len(payload['tables']) == 1


def test_missing_workbook_raises_error(tmp_path):
    missing = tmp_path / 'missing.xlsx'
    try:
        build_payload(str(missing), cache_ttl=1)
        assert False, 'Expected FileNotFoundError'
    except FileNotFoundError:
        pass
