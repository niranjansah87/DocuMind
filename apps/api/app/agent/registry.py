from typing import Literal, cast

ToolName = Literal["search_docs", "get_order_status", "create_ticket"]
TOOL_REGISTRY: frozenset[ToolName] = frozenset({"search_docs", "get_order_status", "create_ticket"})


def require_registered_tool(name: str) -> ToolName:
    if name not in TOOL_REGISTRY:
        raise ValueError("Tool is not registered")
    return cast(ToolName, name)
