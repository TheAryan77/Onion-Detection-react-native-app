from app.services.grading import grade_onion, load_rules, summarize

RULES = load_rules()


def test_clean_onion_is_grade_a():
    cat, flag, reasons = grade_onion([], 55.0, RULES)
    assert cat == "GRADE_A" and flag is None and reasons == []


def test_rotten_is_downgraded():
    cat, _, reasons = grade_onion([{"type": "rotten", "confidence": 0.8}], 55.0, RULES)
    assert cat == "URS" and "rotten" in reasons[0]


def test_undersized():
    cat, flag, _ = grade_onion([], 30.0, RULES)
    assert flag == "undersized" and cat == "URS"


def test_no_marker_skips_size_check():
    cat, flag, _ = grade_onion([], None, RULES)
    assert cat == "GRADE_A" and flag is None


def test_summary_percentages_and_verdict():
    good = {"category": "GRADE_A", "defects": [], "size_flag": None}
    bad = {"category": "URS", "defects": [{"type": "rotten"}], "size_flag": None}
    s = summarize([good, good, good, bad], RULES)
    assert s["grade_a_pct"] == 75.0 and s["urs_pct"] == 25.0
    assert s["defect_counts"]["rotten"] == 1
    assert s["lot_verdict"] == "URS"


def test_empty():
    assert summarize([], RULES)["lot_verdict"] == "NO_ONIONS"
