import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Any


@dataclass
class OperationalMetrics:
    start_time: float = field(default_factory=time.time)
    _lock: Lock = field(default_factory=Lock)

    # Counters: (route, status) -> count
    http_requests_total: dict[tuple[str, int], int] = field(
        default_factory=lambda: defaultdict(int)
    )
    # Latency sums and counts for computing averages
    http_duration_seconds_sum: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    http_duration_seconds_count: dict[str, int] = field(default_factory=lambda: defaultdict(int))

    # Business metrics
    documents_ingested_total: int = 0
    document_chunks_created_total: int = 0
    chat_requests_total: dict[str, int] = field(
        default_factory=lambda: defaultdict(int)
    )  # route -> count
    orders_looked_up_total: int = 0
    tickets_prepared_total: int = 0
    tickets_confirmed_total: int = 0
    rate_limit_exceeded_total: int = 0

    def record_http_request(self, route: str, status_code: int, duration_seconds: float) -> None:
        with self._lock:
            # Normalize route to prevent high-cardinality label explosion
            clean_route = self._normalize_route(route)
            self.http_requests_total[(clean_route, status_code)] += 1
            self.http_duration_seconds_sum[clean_route] += duration_seconds
            self.http_duration_seconds_count[clean_route] += 1

    def record_ingestion(self, chunk_count: int) -> None:
        with self._lock:
            self.documents_ingested_total += 1
            self.document_chunks_created_total += chunk_count

    def record_chat(self, route_type: str) -> None:
        with self._lock:
            self.chat_requests_total[route_type] += 1

    def record_order_lookup(self) -> None:
        with self._lock:
            self.orders_looked_up_total += 1

    def record_ticket_action(self, action: str) -> None:
        with self._lock:
            if action == "prepared":
                self.tickets_prepared_total += 1
            elif action == "confirmed":
                self.tickets_confirmed_total += 1

    def record_rate_limit_exceeded(self) -> None:
        with self._lock:
            self.rate_limit_exceeded_total += 1

    @staticmethod
    def _normalize_route(path: str) -> str:
        """Collapse UUIDs and specific identifiers to avoid metric label explosion."""
        parts = path.strip("/").split("/")
        normalized = []
        for part in parts:
            # Check for UUID format
            if (
                len(part) == 36
                and part.count("-") == 4
                or part.startswith("ORD-")
                or part.startswith("TKT-")
            ):
                normalized.append("{id}")
            else:
                normalized.append(part)
        return "/" + "/".join(normalized) if normalized else "/"

    def to_prometheus(self, db_healthy: bool = True) -> str:
        with self._lock:
            uptime = time.time() - self.start_time
            lines = [
                "# HELP documind_uptime_seconds Application uptime in seconds",
                "# TYPE documind_uptime_seconds gauge",
                f"documind_uptime_seconds {uptime:.2f}",
                "",
                "# HELP documind_database_healthy Database connection status (1 = up, 0 = down)",
                "# TYPE documind_database_healthy gauge",
                f"documind_database_healthy {1 if db_healthy else 0}",
                "",
                "# HELP documind_http_requests_total Total HTTP requests by route and status",
                "# TYPE documind_http_requests_total counter",
            ]

            for (route, status), count in sorted(self.http_requests_total.items()):
                lines.append(
                    f'documind_http_requests_total{{route="{route}",status="{status}"}} {count}'
                )

            lines.extend(
                [
                    "",
                    "# HELP documind_http_request_duration_seconds_sum Total request duration by route",
                    "# TYPE documind_http_request_duration_seconds_sum counter",
                ]
            )
            for route, dur in sorted(self.http_duration_seconds_sum.items()):
                lines.append(
                    f'documind_http_request_duration_seconds_sum{{route="{route}"}} {dur:.4f}'
                )

            lines.extend(
                [
                    "",
                    "# HELP documind_http_request_duration_seconds_count Total request count by route for average latency",
                    "# TYPE documind_http_request_duration_seconds_count counter",
                ]
            )
            for route, count in sorted(self.http_duration_seconds_count.items()):
                lines.append(
                    f'documind_http_request_duration_seconds_count{{route="{route}"}} {count}'
                )

            lines.extend(
                [
                    "",
                    "# HELP documind_documents_ingested_total Total uploaded documents successfully ingested",
                    "# TYPE documind_documents_ingested_total counter",
                    f"documind_documents_ingested_total {self.documents_ingested_total}",
                    "",
                    "# HELP documind_document_chunks_total Total text chunks indexed in pgvector",
                    "# TYPE documind_document_chunks_total counter",
                    f"documind_document_chunks_total {self.document_chunks_created_total}",
                    "",
                    "# HELP documind_chat_requests_total Total chat requests by route type",
                    "# TYPE documind_chat_requests_total counter",
                ]
            )
            for rtype, count in sorted(self.chat_requests_total.items()):
                lines.append(f'documind_chat_requests_total{{route="{rtype}"}} {count}')

            lines.extend(
                [
                    "",
                    "# HELP documind_orders_looked_up_total Total order status queries",
                    "# TYPE documind_orders_looked_up_total counter",
                    f"documind_orders_looked_up_total {self.orders_looked_up_total}",
                    "",
                    "# HELP documind_tickets_total Total support tickets prepared and confirmed",
                    "# TYPE documind_tickets_total counter",
                    f'documind_tickets_total{{action="prepared"}} {self.tickets_prepared_total}',
                    f'documind_tickets_total{{action="confirmed"}} {self.tickets_confirmed_total}',
                    "",
                    "# HELP documind_rate_limit_exceeded_total Total 429 rate limit rejections",
                    "# TYPE documind_rate_limit_exceeded_total counter",
                    f"documind_rate_limit_exceeded_total {self.rate_limit_exceeded_total}",
                ]
            )

            return "\n".join(lines) + "\n"

    def to_dict(self, db_healthy: bool = True) -> dict[str, Any]:
        with self._lock:
            uptime = time.time() - self.start_time
            return {
                "uptime_seconds": round(uptime, 2),
                "database_healthy": db_healthy,
                "documents_ingested": self.documents_ingested_total,
                "document_chunks_created": self.document_chunks_created_total,
                "chat_requests": dict(self.chat_requests_total),
                "orders_looked_up": self.orders_looked_up_total,
                "tickets": {
                    "prepared": self.tickets_prepared_total,
                    "confirmed": self.tickets_confirmed_total,
                },
                "rate_limit_exceeded": self.rate_limit_exceeded_total,
                "total_http_requests": sum(self.http_requests_total.values()),
            }


# Singleton metrics collector
metrics = OperationalMetrics()
