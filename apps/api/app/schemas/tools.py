import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

ORDER_PATTERN = re.compile(r"^ORD-[0-9]{4,}$")


class OrderStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    order_number: str

    @field_validator("order_number")
    @classmethod
    def validate_order_number(cls, value: str) -> str:
        normalized = value.upper()
        if not ORDER_PATTERN.fullmatch(normalized):
            raise ValueError("order_number must match ORD- followed by at least four digits")
        return normalized


class OrderStatusResponse(BaseModel):
    found: bool
    order_number: str
    status: str | None = None
    items: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class TicketPrepareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10, max_length=5000)
    order_number: str | None = None

    @field_validator("order_number")
    @classmethod
    def validate_optional_order_number(cls, value: str | None) -> str | None:
        return OrderStatusRequest(order_number=value).order_number if value else None


class TicketPrepareResponse(BaseModel):
    confirmation_required: bool = True
    pending_action_id: uuid.UUID
    summary: str
    expires_at: datetime


class TicketConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pending_action_id: uuid.UUID
    confirmed: bool


class TicketConfirmResponse(BaseModel):
    created: bool
    ticket_id: uuid.UUID
    ticket_number: str
    status: str
