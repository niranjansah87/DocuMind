import re
from dataclasses import dataclass
from typing import Literal

ORDER_NUMBER = re.compile(r"\bORD-[0-9]{4,}\b", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class RouteDecision:
    route: Literal["rag", "order"]
    order_number: str | None = None


def route_message(message: str) -> RouteDecision:
    """doc-mind-ai: Deterministic intent router balancing latency, cost, and safety.

    Routes simple document Q&A to plain RAG and structured transactional requests
    (such as order status lookups) to database-backed tool agents.

    Why not use an agent for everything?
    1. Latency & throughput: Direct RAG avoids multi-turn LLM reasoning overhead and streaming delays.
    2. Cost predictability: Plain RAG requires a single completion pass instead of exploratory tool calling loops.
    3. Deterministic safety: Sensitive transactional operations (orders, tickets) require strict validation
       and human confirmation, preventing autonomous agent hallucinations or unintended tool execution.
    """
    match = ORDER_NUMBER.search(message)
    if match:
        return RouteDecision("order", match.group(0).upper())
    return RouteDecision("rag")
