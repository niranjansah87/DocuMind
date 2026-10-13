import pytest

from app.agent.registry import TOOL_REGISTRY, require_registered_tool


def test_tool_registry_is_fixed() -> None:
    assert {"search_docs", "get_order_status", "create_ticket"} == TOOL_REGISTRY
    assert require_registered_tool("search_docs") == "search_docs"
    with pytest.raises(ValueError):
        require_registered_tool("run_sql")
