from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.assistant import _contents, build_system_prompt

client = TestClient(app)


def test_prompt_includes_rules_and_report():
    prompt = build_system_prompt({"batchId": "ON-1", "summary": {"lot_verdict": "URS"}})
    assert "category_by_defect" in prompt and "ON-1" in prompt


def test_prompt_without_report():
    assert "none is open" in build_system_prompt(None)


def test_history_starts_with_user_and_maps_roles():
    msgs = [{"role": "assistant", "text": "hi"}, {"role": "user", "text": "why URS?"}, {"role": "assistant", "text": "because"}]
    out = _contents(msgs)
    assert [c["role"] for c in out] == ["user", "model"]


def test_chat_without_key_explains_setup(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    r = client.post("/chat", json={"messages": [{"role": "user", "text": "hello"}]})
    assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]
