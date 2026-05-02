import json
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.advisor import _dispatch_tool


def test_suggest_followups_returns_proposed_true():
    chips = [
        {"emoji": "🌿", "text": "What else should I know?"},
        {"emoji": "📋", "text": "Show me what's overdue"},
    ]
    result = json.loads(_dispatch_tool("suggest_followups", {"chips": chips}, "test_user"))
    assert result["proposed"] is True
    assert result["chips_count"] == 2


def test_suggest_followups_empty_chips():
    result = json.loads(_dispatch_tool("suggest_followups", {"chips": []}, "test_user"))
    assert result["proposed"] is True
    assert result["chips_count"] == 0
