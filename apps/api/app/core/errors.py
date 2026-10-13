from dataclasses import dataclass


@dataclass(slots=True)
class AppError(Exception):
    code: str
    message: str
    status_code: int


class ProviderUnavailableError(AppError):
    def __init__(self) -> None:
        super().__init__("PROVIDER_UNAVAILABLE", "The AI provider is unavailable.", 503)


class ToolUnavailableError(Exception):
    pass
