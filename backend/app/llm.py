import os, requests, math, textwrap
from typing import Any

LLM_PROVIDER    = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3.2:3b-instruct")

# naive chunker (word-based so we avoid tokenizers)
def _chunk(text: str, max_words: int = 900):
    words = text.split()
    for i in range(0, len(words), max_words):
        yield " ".join(words[i : i + max_words])

def _extract_plain_text(content: Any) -> str:
    """Turn stored editor content (string/Quill Delta/dict/list) into plain text."""
    try:
        if isinstance(content, str):
            return content
        if isinstance(content, dict):
            # Quill Delta shape
            if "ops" in content and isinstance(content["ops"], list):
                parts: list[str] = []
                for op in content["ops"]:
                    ins = op.get("insert")
                    if isinstance(ins, str):
                        parts.append(ins)
                return "".join(parts)
            # generic dict
            return str(content)
        if isinstance(content, list):
            return "\n".join(_extract_plain_text(x) for x in content)
        return str(content)
    except Exception:
        return ""

BASE_PROMPT = """You are essentially a cat but also a helpful assistant. Summarize the document for a busy teammate.
- Keep it short (5-7 bullets).
- Be specific; include names, dates, metrics if present.
- Have the summary in the same language as the input document.
- Cute tone, no fluff, but be nice and don't forget to be a cat (so you need to purr sometimes)."""

CHUNK_PROMPT = """Summarize this part in 2-3 bullets, preserving key facts:

{chunk}
"""

REDUCE_PROMPT = """You are given partial summaries of different parts of a document.
Merge them into a single concise summary (5-7 bullets), deduplicating overlaps.

Part summaries:
{parts}
"""

def _ollama_generate(prompt: str, temperature: float = 0.3) -> str:
    url = f"{OLLAMA_BASE_URL}/api/generate"
    resp = requests.post(url, json={
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "temperature": temperature,
        "stream": False,
    }, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()

def summarize_text(text: str) -> str:
    text = _extract_plain_text(text).strip()
    if not text:
        return "Document is empty."

    # short docs: single-shot
    if len(text.split()) < 900:
        prompt = f"{BASE_PROMPT}\n\nDocument:\n{text}"
        return _ollama_generate(prompt)

    # long docs: map-reduce style
    parts = []
    for chunk in _chunk(text, max_words=900):
        parts.append(_ollama_generate(CHUNK_PROMPT.format(chunk=chunk)))

    merged = _ollama_generate(REDUCE_PROMPT.format(parts="\n\n".join(parts)))
    return merged
