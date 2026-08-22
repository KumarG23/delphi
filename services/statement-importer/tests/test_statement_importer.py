from __future__ import annotations

from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient

from app import create_app
from paypal_parser import diagnose_paypal_pdf, parse_paypal_pdf, parse_paypal_rows


def sample_rows() -> list[list[str]]:
    return [
        ["Date", "Description", "Name \\ Email", "Gross", "Fee", "Net"],
        [
            "8/4/2026",
            "Express Checkout Payment\nID: PAYPAL-EXPENSE-1",
            "Example Store\nbilling@example.invalid",
            "-25.00",
            "0.00",
            "-25.00",
        ],
        [
            "8/5/2026",
            "General Payment\nID: PAYPAL-INCOME-1",
            "Example Sender\nsender@example.invalid",
            "50.00",
            "-1.75",
            "48.25",
        ],
        [
            "8/6/2026",
            "Bank Withdrawal to PP Account\nID: PAYPAL-TRANSFER-1",
            "Example Bank",
            "-20.00",
            "0.00",
            "-20.00",
        ],
    ]


def make_paypal_pdf(rows: list[list[str]] | None = None, currency: str = "USD") -> bytes:
    rows = rows or sample_rows()
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((40, 45), f"Transaction History - {currency}", fontsize=12)

    x_positions = [40, 105, 285, 440, 490, 540, 590]
    y_start = 70
    row_height = 54
    for x in x_positions:
        page.draw_line((x, y_start), (x, y_start + row_height * len(rows)), color=(0, 0, 0))
    for index in range(len(rows) + 1):
        y = y_start + row_height * index
        page.draw_line((x_positions[0], y), (x_positions[-1], y), color=(0, 0, 0))

    for row_index, row in enumerate(rows):
        y = y_start + row_height * row_index + 14
        for column_index, cell in enumerate(row):
            for line_index, line in enumerate(cell.splitlines()):
                page.insert_text(
                    (x_positions[column_index] + 3, y + line_index * 11),
                    line,
                    fontsize=7,
                )

    payload = doc.tobytes()
    doc.close()
    return payload


def make_paypal_credit_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((32, 50), "Account Activity", fontsize=10)
    page.insert_text((32, 72), "Payments & Credits", fontsize=9)
    page.insert_text((32, 86), "Tran Date", fontsize=7)
    page.insert_text((92, 86), "Post Date", fontsize=7)
    page.insert_text((150, 86), "Reference Number", fontsize=7)
    page.insert_text((264, 86), "Description", fontsize=7)
    page.insert_text((555, 86), "Amount", fontsize=7)
    page.insert_text((32, 100), "8/1/2026", fontsize=7)
    page.insert_text((92, 100), "8/2/2026", fontsize=7)
    page.insert_text((150, 100), "REFPAYMENT1234567", fontsize=7)
    page.insert_text((264, 100), "Payment - Thank You", fontsize=7)
    page.insert_text((550, 100), "$100.00", fontsize=7)

    page.insert_text((32, 132), "Purchases", fontsize=9)
    page.insert_text((32, 146), "Tran Date", fontsize=7)
    page.insert_text((92, 146), "Post Date", fontsize=7)
    page.insert_text((150, 146), "Description", fontsize=7)
    page.insert_text((555, 146), "Amount", fontsize=7)
    page.insert_text((32, 160), "8/3/2026", fontsize=7)
    page.insert_text((92, 160), "8/4/2026", fontsize=7)
    page.insert_text((150, 160), "Example Merchant", fontsize=7)
    page.insert_text((550, 160), "$25.00", fontsize=7)
    page.insert_text((32, 200), "Statement Closing Date 8/10/2026", fontsize=8)
    page.insert_text((302, 220), "Payment Information", fontsize=9)
    page.insert_text((302, 236), "New Balance", fontsize=7)
    page.insert_text((536, 236), "$3,100.00", fontsize=7)
    page.insert_text((302, 250), "Minimum Payment Due", fontsize=7)
    page.insert_text((536, 250), "$100.00", fontsize=7)
    page.insert_text((302, 264), "Payment Due Date", fontsize=7)
    page.insert_text((536, 264), "9/4/2026", fontsize=7)

    payload = doc.tobytes()
    doc.close()
    return payload


def make_credit_section_pdf(
    section: str,
    description: str = "Example Merchant",
    transaction_date: str = "8/3/2026",
) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((32, 50), "Account Activity", fontsize=10)
    page.insert_text((32, 72), section, fontsize=9)
    page.insert_text((32, 86), "Tran Date", fontsize=7)
    page.insert_text((92, 86), "Post Date", fontsize=7)
    page.insert_text((150, 86), "Description", fontsize=7)
    page.insert_text((555, 86), "Amount", fontsize=7)
    page.insert_text((32, 100), transaction_date, fontsize=7)
    page.insert_text((92, 100), "8/4/2026", fontsize=7)
    page.insert_text((150, 100), description, fontsize=7)
    page.insert_text((550, 100), "$25.00", fontsize=7)
    payload = doc.tobytes()
    doc.close()
    return payload


def make_identical_credit_rows_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((32, 50), "Account Activity", fontsize=10)
    page.insert_text((32, 72), "Purchases", fontsize=9)
    page.insert_text((32, 86), "Tran Date", fontsize=7)
    page.insert_text((92, 86), "Post Date", fontsize=7)
    page.insert_text((150, 86), "Description", fontsize=7)
    page.insert_text((555, 86), "Amount", fontsize=7)
    for y in (100, 116):
        page.insert_text((32, y), "8/3/2026", fontsize=7)
        page.insert_text((92, y), "8/4/2026", fontsize=7)
        page.insert_text((150, y), "Example Merchant", fontsize=7)
        page.insert_text((550, y), "$25.00", fontsize=7)
    payload = doc.tobytes()
    doc.close()
    return payload


def make_intervening_credit_section_pdf(
    boundary: str,
    transaction_date: str = "8/3/2026",
    boundary_x: int = 32,
) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((32, 50), "Account Activity", fontsize=10)
    page.insert_text((32, 72), "Purchases", fontsize=9)
    page.insert_text((32, 86), "Tran Date", fontsize=7)
    page.insert_text((92, 86), "Post Date", fontsize=7)
    page.insert_text((150, 86), "Description", fontsize=7)
    page.insert_text((555, 86), "Amount", fontsize=7)
    page.insert_text((boundary_x, 100), boundary, fontsize=9)
    page.insert_text((32, 116), transaction_date, fontsize=7)
    page.insert_text((92, 116), "8/4/2026", fontsize=7)
    page.insert_text((150, 116), "Summary-shaped row", fontsize=7)
    page.insert_text((550, 116), "$25.00", fontsize=7)
    payload = doc.tobytes()
    doc.close()
    return payload


def make_credit_snapshot_layout_pdf(
    balance_text: str = "$3,100.00",
    *,
    cross_page: bool = False,
    include_decoy: bool = False,
) -> bytes:
    doc = pymupdf.open(stream=make_credit_section_pdf("Purchases"), filetype="pdf")
    date_page = doc[0]
    date_page.insert_text((32, 200), "Statement Closing Date 8/10/2026", fontsize=8)
    balance_page = doc.new_page(width=612, height=792) if cross_page else date_page
    if include_decoy:
        balance_page.insert_text((32, 210), "New Balance", fontsize=7)
        balance_page.insert_text((180, 210), "$5.00", fontsize=7)
    balance_page.insert_text((302, 220), "Payment Information", fontsize=9)
    balance_page.insert_text((302, 236), "New Balance", fontsize=7)
    balance_page.insert_text((536, 236), balance_text, fontsize=7)
    payload = doc.tobytes()
    doc.close()
    return payload


def test_parse_paypal_rows_normalizes_signed_net_and_strips_email() -> None:
    transactions, warnings = parse_paypal_rows(sample_rows(), currency="USD")

    assert warnings == []
    assert transactions == [
        {
            "transactionDate": "2026-08-04",
            "amount": 25.0,
            "kind": "expense",
            "merchant": "Example Store",
            "description": "Express Checkout Payment",
            "externalId": "paypal:PAYPAL-EXPENSE-1",
            "currency": "USD",
        },
        {
            "transactionDate": "2026-08-05",
            "amount": 48.25,
            "kind": "income",
            "merchant": "Example Sender",
            "description": "General Payment",
            "externalId": "paypal:PAYPAL-INCOME-1",
            "currency": "USD",
        },
        {
            "transactionDate": "2026-08-06",
            "amount": 20.0,
            "kind": "transfer",
            "merchant": "Example Bank",
            "description": "Bank Withdrawal to PP Account",
            "externalId": "paypal:PAYPAL-TRANSFER-1",
            "currency": "USD",
        },
    ]
    assert "@" not in repr(transactions)


def test_parse_paypal_rows_collapses_duplicate_transaction_ids() -> None:
    rows = sample_rows()
    rows.append(rows[1].copy())

    transactions, warnings = parse_paypal_rows(rows, currency="USD")

    assert len(transactions) == 3
    assert warnings == ["Skipped 1 duplicate transaction row."]


def test_parse_paypal_rows_rejects_non_usd_tables() -> None:
    transactions, warnings = parse_paypal_rows(sample_rows(), currency="GBP")

    assert transactions == []
    assert warnings == ["Skipped a GBP transaction table; Delphi currently imports USD only."]


@pytest.mark.parametrize(
    "description",
    [
        "Instant Transfer",
        "Add Money from a Bank Account",
        "Balance Account Transfer",
        "Currency Conversion",
    ],
)
def test_parse_paypal_rows_classifies_internal_transfer_variants(description: str) -> None:
    rows = [
        sample_rows()[0],
        [
            "8/7/2026",
            f"{description}\nID: PAYPAL-VARIANT-1",
            "PayPal",
            "-10.00",
            "0.00",
            "-10.00",
        ],
    ]

    transactions, warnings = parse_paypal_rows(rows, currency="USD")

    assert warnings == []
    assert transactions[0]["kind"] == "transfer"


def test_parse_paypal_pdf_extracts_transaction_table() -> None:
    result = parse_paypal_pdf(make_paypal_pdf())

    assert result["provider"] == "paypal"
    assert result["transactionCount"] == 3
    assert result["dateRange"] == {"start": "2026-08-04", "end": "2026-08-06"}
    assert result["transactions"][0]["externalId"] == "paypal:PAYPAL-EXPENSE-1"


def test_parse_paypal_credit_activity_without_drawn_table() -> None:
    result = parse_paypal_pdf(make_paypal_credit_pdf())

    assert result["provider"] == "paypal"
    assert result["transactionCount"] == 2
    assert result["dateRange"] == {"start": "2026-08-01", "end": "2026-08-03"}
    assert result["snapshot"] == {
        "snapshotDate": "2026-08-10",
        "balance": 3100.0,
        "minPayment": 100.0,
        "paymentDueDate": "2026-09-04",
    }
    assert result["transactions"] == [
        {
            "transactionDate": "2026-08-01",
            "amount": 100.0,
            "kind": "transfer",
            "merchant": "Payment - Thank You",
            "description": "Payment - Thank You",
            "externalId": "paypal-credit:REFPAYMENT1234567",
            "currency": "USD",
        },
        {
            "transactionDate": "2026-08-03",
            "amount": 25.0,
            "kind": "expense",
            "merchant": "Example Merchant",
            "description": "Example Merchant",
            "externalId": "paypal:fingerprint:26f136a7c93762b372501def:p1:y1525",
            "currency": "USD",
        },
    ]


def test_paypal_credit_snapshot_requires_date_and_payment_block_on_same_page() -> None:
    result = parse_paypal_pdf(make_credit_snapshot_layout_pdf(cross_page=True))

    assert result["snapshot"] is None


def test_paypal_credit_snapshot_ignores_earlier_new_balance_decoy() -> None:
    result = parse_paypal_pdf(make_credit_snapshot_layout_pdf(include_decoy=True))

    assert result["snapshot"]["balance"] == 3100.0


def test_paypal_credit_snapshot_preserves_negative_credit_balance() -> None:
    result = parse_paypal_pdf(make_credit_snapshot_layout_pdf(balance_text="($5.00)"))

    assert result["snapshot"]["balance"] == -5.0


@pytest.mark.parametrize("section", ["Statement Summary", "APR Information"])
def test_paypal_credit_rejects_row_geometry_outside_transaction_sections(section: str) -> None:
    with pytest.raises(ValueError, match="No readable PayPal transaction table"):
        parse_paypal_pdf(make_credit_section_pdf(section))


def test_paypal_credit_preserves_identical_reference_less_rows() -> None:
    result = parse_paypal_pdf(make_identical_credit_rows_pdf())

    assert result["transactionCount"] == 2
    assert len({row["externalId"] for row in result["transactions"]}) == 2


@pytest.mark.parametrize(
    ("boundary", "boundary_x"),
    [
        ("Statement Summary", 32),
        ("Statement Summary", 201),
        ("Statement Summary", 300),
        ("APR Information", 32),
        ("APR Information", 201),
        ("APR Information", 300),
    ],
)
def test_paypal_credit_header_expires_at_next_structural_heading(
    boundary: str,
    boundary_x: int,
) -> None:
    with pytest.raises(ValueError, match="No readable PayPal transaction table"):
        parse_paypal_pdf(make_intervening_credit_section_pdf(boundary, boundary_x=boundary_x))


def test_paypal_credit_skips_regex_shaped_invalid_dates() -> None:
    with pytest.raises(ValueError, match="No readable PayPal transaction table"):
        parse_paypal_pdf(make_credit_section_pdf("Purchases", transaction_date="13/40/2026"))


@pytest.mark.parametrize(
    ("section", "description", "expected_kind"),
    [
        ("Payments & Credits", "Automatic Payment - Thank You", "transfer"),
        ("Credits", "Merchant Refund", "income"),
        ("Interest Charged", "Interest Charge on Purchases", "expense"),
        ("Purchases", "Example Merchant", "expense"),
    ],
)
def test_paypal_credit_classifies_allowed_sections(
    section: str,
    description: str,
    expected_kind: str,
) -> None:
    result = parse_paypal_pdf(make_credit_section_pdf(section, description))

    assert result["transactionCount"] == 1
    assert result["transactions"][0]["kind"] == expected_kind


def test_parse_paypal_pdf_rejects_non_pdf_and_image_only_pdf() -> None:
    with pytest.raises(ValueError, match="valid PDF"):
        parse_paypal_pdf(b"not a pdf")

    doc = pymupdf.open()
    doc.new_page()
    blank = doc.tobytes()
    doc.close()
    with pytest.raises(ValueError, match="No readable PayPal transaction table"):
        parse_paypal_pdf(blank)


def test_format_diagnostic_preserves_structure_without_financial_text() -> None:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((40, 50), "PayPal Activity Statement")
    page.insert_text(
        (40, 80),
        "8/4/2026 Example Store billing@example.invalid -25.00 ID: PRIVATE-ID-12345",
    )
    payload = doc.tobytes()
    doc.close()

    diagnostic = diagnose_paypal_pdf(payload)
    rendered = repr(diagnostic)

    assert diagnostic["pages"] == 1
    assert diagnostic["dateTokens"] == 1
    assert diagnostic["amountTokens"] == 1
    assert diagnostic["emailTokens"] == 1
    assert diagnostic["idTokens"] == 1
    assert "activity" in diagnostic["headerTerms"]
    assert "Example Store" not in rendered
    assert "billing@example.invalid" not in rendered
    assert "-25.00" not in rendered
    assert "PRIVATE-ID-12345" not in rendered


def test_api_requires_authentication_and_rejects_oversized_upload() -> None:
    client = TestClient(
        create_app(
            authenticator=lambda token: {"id": "user-1"} if token == "valid" else None,
            max_upload_bytes=10,
        )
    )

    unauthenticated = client.post(
        "/v1/statements/parse",
        content=b"%PDF-1.4",
        headers={"Content-Type": "application/pdf"},
    )
    assert unauthenticated.status_code == 401

    oversized = client.post(
        "/v1/statements/parse",
        content=b"%PDF-1.4-too-large",
        headers={"Authorization": "Bearer valid", "Content-Type": "application/pdf"},
    )
    assert oversized.status_code == 413


def test_api_parses_authenticated_pdf_without_persisting_it(tmp_path: Path) -> None:
    client = TestClient(create_app(authenticator=lambda token: {"id": "user-1"} if token == "valid" else None))
    before = set(tmp_path.iterdir())

    response = client.post(
        "/v1/statements/parse",
        content=make_paypal_pdf(),
        headers={"Authorization": "Bearer valid", "Content-Type": "application/pdf"},
    )

    assert response.status_code == 200
    assert response.json()["transactionCount"] == 3
    assert set(tmp_path.iterdir()) == before
