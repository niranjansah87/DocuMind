import uuid

DEMO_OWNER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def get_owner_id() -> uuid.UUID:
    return DEMO_OWNER_ID
