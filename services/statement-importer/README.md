# Delphi statement importer

Private PayPal PDF parser used by Delphi's in-app statement drop.

## Privacy boundary

- Binds only to `127.0.0.1:8790`.
- Exposed only through the tailnet-only Tailscale Serve route at `/delphi-import`.
- Requires a valid Delphi Supabase access token for PDF parsing.
- Sends no statement content to an LLM or third-party parser.
- Does not log request bodies or transaction rows.
- Streams the authenticated raw PDF body into bounded memory; no multipart spool or retained temporary file is used.
- Returns normalized transactions without email addresses.

## Deployment

The live copy is `/home/neal/services/delphi-statement-importer`; its virtual environment remains there across code copies.

```bash
python -m venv /home/neal/services/delphi-statement-importer/.venv
/home/neal/services/delphi-statement-importer/.venv/bin/pip install -r requirements.txt
systemctl --user enable --now delphi-statement-importer.service
sudo tailscale serve --bg --https=8443 --set-path=/delphi-import http://127.0.0.1:8790
```

The mode-`0600` environment file at `~/.config/delphi-statement-importer/env` contains:

```text
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## Verification

```bash
PYTHONPATH=. /home/neal/services/delphi-statement-importer/.venv/bin/pytest -q
curl -fsS http://127.0.0.1:8790/health
curl -fsS https://hermes.tailc88c35.ts.net:8443/delphi-import/health
```
