import json
import sys, os
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _make_request(body: dict, method: str = "POST"):
    """Minimal mock of an Azure Functions HttpRequest."""
    req = MagicMock()
    req.method = method
    req.get_json.return_value = body
    return req


def test_execute_action_mark_done_success():
    with patch("functions.function_app.action_tools") as mock_tools:
        mock_tools.mark_task_done.return_value = {"success": True, "completion_id": "comp_abc"}
        from functions.function_app import execute_action
        req = _make_request({"action_type": "mark_done", "payload": {"task_id": "task_123"}})
        resp = execute_action(req)
        body = json.loads(resp.get_body())
        assert body["ok"] is True
        assert "summary" in body
        mock_tools.mark_task_done.assert_called_once_with("task_123", "usr_heed_demo_001", note=None)


def test_execute_action_missing_action_type():
    from functions.function_app import execute_action
    req = _make_request({"payload": {}})
    resp = execute_action(req)
    assert resp.status_code == 400
    body = json.loads(resp.get_body())
    assert "error" in body


def test_execute_action_unknown_type():
    from functions.function_app import execute_action
    req = _make_request({"action_type": "fly_to_moon", "payload": {}})
    resp = execute_action(req)
    assert resp.status_code == 400


def test_execute_action_options_cors():
    from functions.function_app import execute_action
    req = _make_request({}, method="OPTIONS")
    resp = execute_action(req)
    assert resp.status_code == 204


def test_execute_action_add_task_success():
    with patch("agents.tools.cosmos_tool._get_database") as mock_get_db:
        mock_container = MagicMock()
        mock_get_db.return_value.get_container_client.return_value = mock_container
        from functions.function_app import execute_action
        req = _make_request({
            "action_type": "add_task",
            "payload": {"name": "Buy groceries", "category": "home", "importance": "medium"},
        })
        resp = execute_action(req)
        body = json.loads(resp.get_body())
        assert resp.status_code == 201
        assert body["ok"] is True
        assert "Buy groceries" in body["summary"]
        assert body["task"]["name"] == "Buy groceries"
        assert body["task"]["category"] == "home"
        mock_container.create_item.assert_called_once()


def test_execute_action_add_task_missing_name():
    from functions.function_app import execute_action
    req = _make_request({"action_type": "add_task", "payload": {"category": "home"}})
    resp = execute_action(req)
    assert resp.status_code == 400
    body = json.loads(resp.get_body())
    assert body["ok"] is False
