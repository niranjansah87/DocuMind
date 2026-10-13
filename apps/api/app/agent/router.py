import re
from dataclasses import dataclass
from typing import Literal

ORDER_NUMBER = re.compile(r"\bORD-[0-9]{4,}\b", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class RouteDecision:
    route: Literal["rag", "order"]
    order_number: str | None = None


def route_message(message: str) -> RouteDecision:
    match = ORDER_NUMBER.search(message)
    if match:
        return RouteDecision("order", match.group(0).upper())
    return RouteDecision("rag")
