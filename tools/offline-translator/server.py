# -*- coding: utf-8 -*-
"""
Offline translator for the GNSI ERP Mayek Tool.

Runs IndicTrans2 (AI4Bharat) on this computer and answers the ERP's
translator over http://127.0.0.1:8765, in the same shape as /api/bhashini
and /api/translate:

    POST /translate  { segments: string[], from: 'en', to: code }
                  -> { segments: string[], detected: null, engine: 'indictrans' }
    GET  /health  -> { ok: true, engine: 'indictrans', model, from, to }

English only as the source (that is what the en-indic model does); targets
are Manipuri in Meetei Mayek or Bengali script, Hindi and Bengali.

Setup and everyday use: see README.md next to this file.
"""
import argparse
import json
import os
import re
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"
SOURCES = {"en": "eng_Latn"}
TARGETS = {"mni-Mtei": "mni_Mtei", "mni-Beng": "mni_Beng", "hi": "hin_Deva", "bn": "ben_Beng"}
MAX_SEGMENTS = 400
MAX_CHARS = 60000
MAX_BODY = 1024 * 1024
BATCH = 8

# Pages allowed to call this program from a browser. "null" is the desktop
# (Electron) build, which loads the ERP from a file.
ALLOWED_ORIGINS = {"https://www.guidancekhangabok.in", "https://guidancekhangabok.in", "null"}
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$")

# IndicTrans2 translates one sentence at a time, so each line is split into
# sentences first. A full stop after one of these (or after a number or a
# single letter, as in "12." or "A.") does not end a sentence.
ABBREVIATIONS = {"rs", "no", "nos", "mr", "mrs", "ms", "dr", "st", "vs", "etc", "approx",
                 "fig", "sec", "min", "hr", "hrs", "a.m", "p.m", "i.e", "e.g"}
SENTENCE_END = re.compile(r"[.?!][\"')\]]*\s+(?=[A-Z])")


def split_sentences(line):
    out, start = [], 0
    for m in SENTENCE_END.finditer(line):
        words = line[start:m.start()].split()
        last = words[-1].lower() if words else ""
        if line[m.start()] == "." and (last in ABBREVIATIONS or len(last) == 1 or last.isdigit()):
            continue
        out.append(line[start:m.end()].strip())
        start = m.end()
    rest = line[start:].strip()
    if rest:
        out.append(rest)
    return out


class Engine:
    """IndicTrans2, loaded once from the files already downloaded to this computer."""

    def __init__(self, model_name):
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        try:
            from IndicTransToolkit.processor import IndicProcessor
        except ImportError:
            from IndicTransToolkit import IndicProcessor
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name, trust_remote_code=True)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device).eval()
        self.ip = IndicProcessor(inference=True)

    def translate(self, sentences, src, tgt):
        out = []
        for i in range(0, len(sentences), BATCH):
            batch = self.ip.preprocess_batch(sentences[i:i + BATCH], src_lang=src, tgt_lang=tgt)
            enc = self.tok(batch, truncation=True, padding="longest", return_tensors="pt").to(self.device)
            with self.torch.no_grad():
                # use_cache=False: the model's own code breaks with the cache on
                # under current transformers releases.
                gen = self.model.generate(**enc, use_cache=False, min_length=0, max_length=256,
                                          num_beams=5, num_return_sequences=1)
            dec = self.tok.batch_decode(gen, skip_special_tokens=True, clean_up_tokenization_spaces=True)
            out.extend(self.ip.postprocess_batch(dec, lang=tgt))
        return out


def translate_segments(engine, segments, src, tgt):
    """Translate each segment line by line, keeping blank lines and indents."""
    sentences, layout = [], []
    for seg in segments:
        lines = []
        for line in seg.split("\n"):
            parts = split_sentences(line)
            indent = line[:len(line) - len(line.lstrip())]
            lines.append((indent, len(sentences), len(parts)) if parts else None)
            sentences.extend(parts)
        layout.append((seg, lines))
    done = engine.translate(sentences, src, tgt) if sentences else []
    if len(done) != len(sentences):
        raise RuntimeError("The model returned a different number of sentences than it was given")
    out = []
    for seg, lines in layout:
        src_lines = seg.split("\n")
        out.append("\n".join(
            src_lines[k] if item is None else item[0] + " ".join(done[item[1]:item[1] + item[2]])
            for k, item in enumerate(lines)))
    return out


def make_handler(engine, model_name, allowed, lock):
    def origin_ok(origin):
        return origin in allowed or bool(LOCAL_ORIGIN.match(origin))

    class Handler(BaseHTTPRequestHandler):
        server_version = "GNSIOfflineTranslator/1"

        def log_message(self, fmt, *args):
            sys.stderr.write("  %s\n" % (fmt % args))

        def _send(self, status, payload=None):
            body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            origin = self.headers.get("Origin")
            if origin and origin_ok(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            if self.command == "OPTIONS":
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                # Chrome asks this before a website may reach a program on this computer.
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")
            if body:
                self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _blocked(self):
            origin = self.headers.get("Origin")
            if origin and not origin_ok(origin):
                self._send(403, {"error": "This page is not allowed to use the offline translator"})
                return True
            return False

        def do_OPTIONS(self):
            if not self._blocked():
                self._send(204)

        def do_GET(self):
            if self._blocked():
                return
            if self.path.split("?")[0] != "/health":
                return self._send(404, {"error": "Not found"})
            self._send(200, {"ok": True, "engine": "indictrans", "model": model_name,
                             "from": sorted(SOURCES), "to": sorted(TARGETS)})

        def do_POST(self):
            if self._blocked():
                return
            if self.path.split("?")[0] != "/translate":
                return self._send(404, {"error": "Not found"})
            try:
                length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                length = -1
            if length < 0 or length > MAX_BODY:
                return self._send(413, {"error": "Text too long — translate it in parts"})
            try:
                data = json.loads(self.rfile.read(length).decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                return self._send(400, {"error": "Body must be JSON"})
            data = data if isinstance(data, dict) else {}
            segments, src, tgt = data.get("segments"), data.get("from"), data.get("to")
            if not isinstance(segments, list) or not segments or any(not isinstance(s, str) for s in segments):
                return self._send(400, {"error": "segments must be a non-empty array of strings"})
            if src not in SOURCES or tgt not in TARGETS:
                return self._send(400, {"error": "Language pair not supported by the offline translator", "fallback": True})
            if len(segments) > MAX_SEGMENTS or sum(len(s) for s in segments) > MAX_CHARS:
                return self._send(413, {"error": "Text too long — translate it in parts"})
            try:
                with lock:  # one translation at a time; the model is not built for parallel calls
                    out = translate_segments(engine, segments, SOURCES[src], TARGETS[tgt])
            except Exception as e:  # report it to the ERP, which then uses its next engine
                sys.stderr.write("  translation failed: %r\n" % (e,))
                return self._send(500, {"error": str(e), "fallback": True})
            self._send(200, {"segments": out, "detected": None, "engine": "indictrans"})

    return Handler


def main():
    ap = argparse.ArgumentParser(description="Offline translator for the GNSI ERP Mayek Tool")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--model", default=MODEL, help="IndicTrans2 en-indic model already downloaded to this computer")
    ap.add_argument("--allow-origin", action="append", default=[], metavar="URL",
                    help="another site allowed to use this translator, e.g. a Vercel preview address")
    args = ap.parse_args()

    print("Loading the translation model (this takes a minute) ...", flush=True)
    engine = Engine(args.model)
    allowed = ALLOWED_ORIGINS | {o.rstrip("/") for o in args.allow_origin}
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(engine, args.model, allowed, threading.Lock()))
    print("Offline translator is ready at http://127.0.0.1:%d" % args.port)
    print("Keep this window open while you use the ERP. Close it to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
