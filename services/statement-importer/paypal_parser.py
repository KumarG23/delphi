from __future__ import annotations

import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Any

import pymupdf

logger = logging.getLogger(__name__)

EXPECTED_HEADERS = ["date", "description", "name email", "gross", "fee", "net"]
EMAIL_RE = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b", re.IGNORECASE)
TRANSACTION_ID_RE = re.compile(r"\bID:\s*([A-Z0-9-]{8,})\b", re.IGNORECASE)
TRANSFER_RE = re.compile(
    r"\b(bank (?:deposit|withdrawal)|add (?:funds|money)|general withdrawal|cash out|"
    r"instant transfer|balance account transfer|currency conversion|transfer (?:to|from))\b",
    re.IGNORECASE,
)
DATE_TOKEN_RE = re.compile(r"\b(?:\d{1,2}/\d{1,2}/(?:\d{2}|\d{4})|\d{4}-\d{2}-\d{2})\b")
AMOUNT_TOKEN_RE = re.compile(r"(?<![\w.])(?:[-+]?\$?\d[\d,]*\.\d{2}|\([-+]?\$?\d[\d,]*\.\d{2}\))")
HEADER_TERMS = (
    "activity",
    "balance",
    "currency",
    "date",
    "description",
    "ending balance",
    "fee",
    "gross",
    "name",
    "net",
    "payment",
    "status",
    "summary",
    "transaction",
    "transaction id",
    "type",
)
CREDIT_SECTION_RE = re.compile(
    r"^(?:payments?(?:\s*(?:&|and)\s*credits?)?|credits?|"
    r"purchases?(?:\s*(?:&|and)\s*(?:other\s*)?charges?)?|"
    r"fees?(?:\s*(?:&|and)\s*interest(?:\s+charges?)?)?|"
    r"interest\s+charge(?:d|s)?|adjustments?)$",
    re.IGNORECASE,
)
REFERENCE_RE = re.compile(r"^[A-Z0-9-]{10,}$", re.IGNORECASE)
NON_TRANSACTION_SECTION_RE = re.compile(
    r"\b(?:summary|apr|annual percentage rate|balance information|account information)\b",
    re.IGNORECASE,
)


def _normalize_header(value: str | None) -> str:
    return re.sub(r"[^a-z]+", " ", (value or "").lower()).strip()


def _parse_date(value: str) -> str:
    raw = value.strip().splitlines()[0].strip()
    for pattern in ("%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, pattern).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"Unsupported PayPal transaction date: {raw}")


def _parse_amount(value: str | None) -> float:
    raw = (value or "").strip().replace(",", "").replace("$", "").replace("−", "-")
    if not raw:
        return 0.0
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    raw = raw.strip("()")
    amount = float(raw)
    return -abs(amount) if negative_parentheses else amount


def _clean_lines(value: str | None) -> list[str]:
    return [line.strip() for line in (value or "").splitlines() if line.strip()]


def _merchant_from_cell(name_cell: str | None, description: str) -> str:
    candidates = [
        line
        for line in _clean_lines(name_cell)
        if not EMAIL_RE.search(line) and not line.upper().startswith("ID:")
    ]
    if candidates:
        return candidates[0][:160]
    return description[:160]


def _description_and_id(value: str | None) -> tuple[str, str | None]:
    lines = _clean_lines(value)
    full = " ".join(lines)
    match = TRANSACTION_ID_RE.search(full)
    transaction_id = match.group(1).upper() if match else None
    description_lines = [line for line in lines if not TRANSACTION_ID_RE.search(line)]
    description = " ".join(description_lines).strip() or "PayPal transaction"
    description = EMAIL_RE.sub("", description)
    description = re.sub(r"\s{2,}", " ", description).strip()
    return description[:240], transaction_id


def _fallback_external_id(date: str, description: str, merchant: str, net: float) -> str:
    material = f"{date}|{description}|{merchant}|{net:.2f}".encode("utf-8")
    return f"paypal:fingerprint:{hashlib.sha256(material).hexdigest()[:24]}"


def parse_paypal_rows(
    rows: list[list[str | None]],
    *,
    currency: str,
) -> tuple[list[dict[str, Any]], list[str]]:
    normalized_currency = currency.upper().strip()
    if normalized_currency != "USD":
        return [], [
            f"Skipped a {normalized_currency or 'non-USD'} transaction table; Delphi currently imports USD only."
        ]
    if not rows or [_normalize_header(cell) for cell in rows[0]] != EXPECTED_HEADERS:
        return [], []

    transactions: list[dict[str, Any]] = []
    seen_external_ids: set[str] = set()
    duplicate_count = 0

    for row in rows[1:]:
        if len(row) < 6 or not (row[0] or "").strip():
            continue
        try:
            date = _parse_date(row[0] or "")
            net = _parse_amount(row[5])
        except (ValueError, TypeError):
            continue
        if net == 0:
            continue

        description, transaction_id = _description_and_id(row[1])
        merchant = _merchant_from_cell(row[2], description)
        kind = "transfer" if TRANSFER_RE.search(description) else ("income" if net > 0 else "expense")
        external_id = (
            f"paypal:{transaction_id}"
            if transaction_id
            else _fallback_external_id(date, description, merchant, net)
        )
        if external_id in seen_external_ids:
            duplicate_count += 1
            continue
        seen_external_ids.add(external_id)
        transactions.append(
            {
                "transactionDate": date,
                "amount": round(abs(net), 2),
                "kind": kind,
                "merchant": merchant,
                "description": description,
                "externalId": external_id,
                "currency": "USD",
            }
        )

    warnings: list[str] = []
    if duplicate_count:
        noun = "row" if duplicate_count == 1 else "rows"
        warnings.append(f"Skipped {duplicate_count} duplicate transaction {noun}.")
    return transactions, warnings


def _currency_for_page(text: str) -> str:
    match = re.search(r"Transaction History\s*-\s*([A-Z]{3})", text, re.IGNORECASE)
    return match.group(1).upper() if match else "USD"


def _format_diagnostic(document: pymupdf.Document) -> dict[str, Any]:
    diagnostic: dict[str, Any] = {
        "pages": document.page_count,
        "textChars": 0,
        "imagePages": 0,
        "lineCount": 0,
        "dateTokens": 0,
        "amountTokens": 0,
        "emailTokens": 0,
        "idTokens": 0,
        "headerTerms": [],
        "layout": [],
    }
    found_headers: set[str] = set()
    layout: list[dict[str, Any]] = []

    for page_index, page in enumerate(document):
        page_text = page.get_text("text")
        diagnostic["textChars"] += len(page_text.strip())
        if page.get_images():
            diagnostic["imagePages"] += 1
        lowered_page = page_text.lower()
        found_headers.update(term for term in HEADER_TERMS if term in lowered_page)

        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                spans = line.get("spans", [])
                raw = " ".join(str(span.get("text", "")) for span in spans).strip()
                if not raw:
                    continue
                diagnostic["lineCount"] += 1
                dates = len(DATE_TOKEN_RE.findall(raw))
                amounts = len(AMOUNT_TOKEN_RE.findall(raw))
                emails = len(EMAIL_RE.findall(raw))
                ids = len(TRANSACTION_ID_RE.findall(raw))
                diagnostic["dateTokens"] += dates
                diagnostic["amountTokens"] += amounts
                diagnostic["emailTokens"] += emails
                diagnostic["idTokens"] += ids

                if len(layout) < 600:
                    bbox = line.get("bbox", (0, 0, 0, 0))
                    line_headers = [term for term in HEADER_TERMS if term in raw.lower()]
                    features: list[str] = []
                    if dates:
                        features.append(f"DATE:{dates}")
                    if amounts:
                        features.append(f"AMOUNT:{amounts}")
                    if emails:
                        features.append(f"EMAIL:{emails}")
                    if ids:
                        features.append(f"ID:{ids}")
                    features.extend(f"HEADER:{term}" for term in line_headers)
                    if not features:
                        features.append("TEXT")
                    layout.append(
                        {
                            "page": page_index + 1,
                            "x": round(float(bbox[0]), 1),
                            "y": round(float(bbox[1]), 1),
                            "width": round(float(bbox[2]) - float(bbox[0]), 1),
                            "chars": min(len(raw), 240),
                            "features": features,
                        }
                    )

    diagnostic["headerTerms"] = sorted(found_headers)
    diagnostic["layout"] = layout
    return diagnostic


def diagnose_paypal_pdf(payload: bytes) -> dict[str, Any]:
    if not payload.startswith(b"%PDF"):
        raise ValueError("The selected file is not a valid PDF.")
    try:
        document = pymupdf.open(stream=payload, filetype="pdf")
    except Exception as exc:
        raise ValueError("The selected file is not a valid PDF.") from exc
    try:
        return _format_diagnostic(document)
    finally:
        document.close()


def _credit_page_lines(page: pymupdf.Page) -> list[dict[str, Any]]:
    lines: list[dict[str, Any]] = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            text = " ".join(
                str(span.get("text", "")) for span in line.get("spans", [])
            ).strip()
            if not text:
                continue
            bbox = line.get("bbox", (0, 0, 0, 0))
            lines.append({"text": text, "x": float(bbox[0]), "y": float(bbox[1])})
    return sorted(lines, key=lambda item: (item["y"], item["x"]))


def _parse_credit_amount(value: str) -> float:
    raw = value.strip().upper().replace(",", "").replace("$", "").replace("−", "-")
    raw = re.sub(r"\s*CR$", "", raw).strip()
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    raw = raw.strip("()")
    amount = float(raw)
    if negative_parentheses:
        amount = -abs(amount)
    return round(abs(amount), 2)


def _credit_kind(section: str, description: str) -> str:
    text = f"{section} {description}".lower()
    if "payment" in description.lower() or "thank you" in description.lower():
        return "transfer"
    if any(term in text for term in ("refund", "credit", "reversal")) and "payment" not in text:
        return "income"
    return "expense"


def _parse_paypal_credit_page(
    page: pymupdf.Page,
    page_number: int,
) -> list[dict[str, Any]]:
    lines = _credit_page_lines(page)
    activity_markers = [
        line["y"]
        for line in lines
        if "activity" in line["text"].lower()
        and line["x"] < 200
        and len(line["text"]) <= 40
    ]
    if not activity_markers:
        return []
    activity_y = min(activity_markers)
    heading_candidates = [
        line
        for line in lines
        if line["y"] > activity_y
        and line["x"] < 200
        and len(line["text"]) <= 40
        and not DATE_TOKEN_RE.search(line["text"])
        and not AMOUNT_TOKEN_RE.search(line["text"])
    ]
    transaction_boundaries = [
        heading
        for heading in heading_candidates
        if CREDIT_SECTION_RE.fullmatch(heading["text"].strip())
    ]
    non_transaction_boundaries = [
        line
        for line in lines
        if line["y"] > activity_y and NON_TRANSACTION_SECTION_RE.search(line["text"])
    ]
    section_boundaries = transaction_boundaries + non_transaction_boundaries
    valid_headers: list[dict[str, Any]] = []
    for header_start in lines:
        if header_start["y"] <= activity_y or header_start["x"] >= 70:
            continue
        if "date" not in header_start["text"].lower():
            continue
        same_header_row = [
            line for line in lines if abs(line["y"] - header_start["y"]) <= 2.5
        ]
        has_post_date = any(
            70 <= line["x"] < 140 and "date" in line["text"].lower()
            for line in same_header_row
        )
        has_description = any(
            130 <= line["x"] < 500 and "description" in line["text"].lower()
            for line in same_header_row
        )
        has_amount = any(
            line["x"] >= 500 and "amount" in line["text"].lower()
            for line in same_header_row
        )
        preceding_headings = [
            heading
            for heading in section_boundaries
            if heading["y"] < header_start["y"]
            and header_start["y"] - heading["y"] <= 40
        ]
        if not (has_post_date and has_description and has_amount and preceding_headings):
            continue
        section = preceding_headings[-1]["text"].strip()
        if not CREDIT_SECTION_RE.fullmatch(section):
            continue
        valid_headers.append({"y": header_start["y"], "section": section})
    transactions: list[dict[str, Any]] = []

    for date_line in lines:
        raw_date = date_line["text"].strip()
        if date_line["y"] <= activity_y or date_line["x"] >= 70:
            continue
        if not DATE_TOKEN_RE.fullmatch(raw_date):
            continue

        same_row = [line for line in lines if abs(line["y"] - date_line["y"]) <= 2.5]
        post_dates = [
            line
            for line in same_row
            if 70 <= line["x"] < 140 and DATE_TOKEN_RE.fullmatch(line["text"].strip())
        ]
        amount_lines = [
            line
            for line in same_row
            if line["x"] >= 500 and AMOUNT_TOKEN_RE.search(line["text"])
        ]
        if not post_dates or not amount_lines:
            continue

        cells = [
            line["text"].strip()
            for line in sorted(same_row, key=lambda item: item["x"])
            if 130 <= line["x"] < 500
        ]
        if not cells:
            continue
        reference = cells[0].upper() if REFERENCE_RE.fullmatch(cells[0]) else None
        description = " ".join(cells[1:] if reference else cells).strip()
        if not description:
            continue

        preceding_headers = [
            header
            for header in valid_headers
            if header["y"] < date_line["y"] and date_line["y"] - header["y"] <= 80
        ]
        if not preceding_headers:
            continue
        selected_header = preceding_headers[-1]
        if any(
            selected_header["y"] < boundary["y"] < date_line["y"]
            for boundary in section_boundaries
        ):
            continue
        section = selected_header["section"]
        try:
            transaction_date = _parse_date(raw_date)
        except ValueError:
            continue
        amount = _parse_credit_amount(amount_lines[-1]["text"])
        external_id = (
            f"paypal-credit:{reference}"
            if reference
            else (
                f"{_fallback_external_id(transaction_date, description, description, amount)}"
                f":p{page_number}:y{int(round(date_line['y'] * 10))}"
            )
        )
        transactions.append(
            {
                "transactionDate": transaction_date,
                "amount": amount,
                "kind": _credit_kind(section, description),
                "merchant": description[:160],
                "description": description[:240],
                "externalId": external_id,
                "currency": "USD",
            }
        )

    return transactions


def _label_key(value: str) -> str:
    return re.sub(r"[^a-z]+", " ", value.lower()).strip()


def _row_text(lines: list[dict[str, Any]], label_line: dict[str, Any]) -> str:
    return " ".join(
        line["text"]
        for line in sorted(lines, key=lambda item: item["x"])
        if abs(line["y"] - label_line["y"]) <= 2.5
    )


def _parse_signed_balance(value: str) -> float:
    raw = value.strip().upper().replace(",", "").replace("$", "").replace("−", "-")
    credit_suffix = bool(re.search(r"\s*CR$", raw))
    raw = re.sub(r"\s*CR$", "", raw).strip()
    negative_parentheses = raw.startswith("(") and raw.endswith(")")
    amount = float(raw.strip("()"))
    if credit_suffix or negative_parentheses:
        amount = -abs(amount)
    return round(amount, 2)


def _parse_date_from_row(lines: list[dict[str, Any]], line: dict[str, Any]) -> str | None:
    date_match = DATE_TOKEN_RE.search(_row_text(lines, line))
    if not date_match:
        return None
    try:
        return _parse_date(date_match.group(0))
    except ValueError:
        return None


def _extract_statement_snapshot(document: pymupdf.Document) -> dict[str, Any] | None:
    for page in document:
        lines = _credit_page_lines(page)
        date_lines = [
            line
            for line in lines
            if _label_key(line["text"]) in {
                "statement closing date",
                "statement date",
                "billing cycle ending",
            }
        ]
        snapshot_dates = [
            parsed
            for line in date_lines
            if (parsed := _parse_date_from_row(lines, line)) is not None
        ]
        if not snapshot_dates:
            continue

        payment_headings = [
            line for line in lines if _label_key(line["text"]) == "payment information"
        ]
        for heading in payment_headings:
            block_lines = [
                line
                for line in lines
                if heading["y"] < line["y"] <= heading["y"] + 80
                and line["x"] >= heading["x"] - 10
            ]
            balance_labels = [
                line
                for line in block_lines
                if _label_key(line["text"]) in {
                    "new balance",
                    "ending balance",
                    "closing balance",
                    "statement balance",
                }
            ]
            if not balance_labels:
                continue
            balance_label = min(balance_labels, key=lambda line: line["y"])
            amount_match = AMOUNT_TOKEN_RE.search(_row_text(lines, balance_label))
            if not amount_match:
                continue
            balance = _parse_signed_balance(amount_match.group(0))

            min_payment: float | None = None
            payment_due_date: str | None = None
            for line in block_lines:
                key = _label_key(line["text"])
                if min_payment is None and key in {
                    "minimum payment due",
                    "minimum payment",
                    "min payment due",
                }:
                    min_match = AMOUNT_TOKEN_RE.search(_row_text(lines, line))
                    if min_match:
                        min_payment = _parse_credit_amount(min_match.group(0))
                if payment_due_date is None and key in {"payment due date", "due date"}:
                    payment_due_date = _parse_date_from_row(lines, line)

            return {
                "snapshotDate": snapshot_dates[0],
                "balance": balance,
                "minPayment": min_payment,
                "paymentDueDate": payment_due_date,
            }

    return None


def parse_paypal_pdf(payload: bytes) -> dict[str, Any]:
    if not payload.startswith(b"%PDF"):
        raise ValueError("The selected file is not a valid PDF.")

    try:
        document = pymupdf.open(stream=payload, filetype="pdf")
    except Exception as exc:
        raise ValueError("The selected file is not a valid PDF.") from exc

    try:
        if document.needs_pass:
            raise ValueError("Password-protected PDFs are not supported yet.")
        if document.page_count > 100:
            raise ValueError("Statement is too long; the limit is 100 pages.")

        transactions: list[dict[str, Any]] = []
        warnings: list[str] = []
        seen_external_ids: set[str] = set()
        duplicate_count = 0
        readable_text = 0
        embedded_image_count = 0

        for page in document:
            page_text = page.get_text("text")
            readable_text += len(page_text.strip())
            embedded_image_count += len(page.get_images())
            currency = _currency_for_page(page_text)
            for table in page.find_tables().tables:
                parsed, table_warnings = parse_paypal_rows(table.extract(), currency=currency)
                warnings.extend(table_warnings)
                for transaction in parsed:
                    external_id = transaction["externalId"]
                    if external_id in seen_external_ids:
                        duplicate_count += 1
                        continue
                    seen_external_ids.add(external_id)
                    transactions.append(transaction)

        if not transactions:
            for page_number, page in enumerate(document, start=1):
                for transaction in _parse_paypal_credit_page(page, page_number):
                    external_id = transaction["externalId"]
                    if external_id in seen_external_ids:
                        duplicate_count += 1
                        continue
                    seen_external_ids.add(external_id)
                    transactions.append(transaction)

        if readable_text == 0 and embedded_image_count:
            raise ValueError("This PDF appears to be image-only. OCR support is not enabled yet.")
        if not transactions:
            logger.warning(
                "UNSUPPORTED_PAYPAL_LAYOUT %s",
                json.dumps(_format_diagnostic(document), separators=(",", ":"), sort_keys=True),
            )
            raise ValueError("No readable PayPal transaction table was found in this PDF.")

        if duplicate_count:
            noun = "row" if duplicate_count == 1 else "rows"
            warnings.append(f"Skipped {duplicate_count} duplicate transaction {noun}.")

        dates = sorted(transaction["transactionDate"] for transaction in transactions)
        return {
            "provider": "paypal",
            "transactionCount": len(transactions),
            "dateRange": {"start": dates[0], "end": dates[-1]},
            "transactions": transactions,
            "snapshot": _extract_statement_snapshot(document),
            "warnings": warnings,
        }
    finally:
        document.close()
