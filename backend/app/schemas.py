from typing import Literal, Optional

from pydantic import BaseModel

Category = Literal["GRADE_A", "URS", "REJECT"]


class Defect(BaseModel):
    type: str                 # cuts | rotten | sprout
    confidence: float
    box: list[float]          # normalised [x1, y1, x2, y2]


class Onion(BaseModel):
    id: int
    box: list[float]
    diameter_mm: Optional[float]
    defects: list[Defect]
    size_flag: Optional[Literal["undersized", "oversized"]]
    category: Category
    reasons: list[str]


class Summary(BaseModel):
    total: int
    grade_a: int
    urs: int
    reject: int
    grade_a_pct: float
    urs_pct: float
    reject_pct: float
    defect_counts: dict[str, int]
    lot_verdict: str          # GRADE_A | URS | REJECT | NO_ONIONS


class AnalysisResult(BaseModel):
    report_id: str
    created_at: str
    mode: Literal["batch", "single"]
    image_width: int
    image_height: int
    calibrated: bool
    px_per_mm: Optional[float]
    onions: list[Onion]
    summary: Summary
    warnings: list[str]
    model_id: str
    rules_version: str
    spec_name: str
    report_hash: str
    annotated_image_b64: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    report: Optional[dict] = None   # compact report from the app (no image), or null when none is open


class ChatReply(BaseModel):
    reply: str
