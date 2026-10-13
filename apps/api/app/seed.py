import asyncio
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

from app.api.dependencies import DEMO_OWNER_ID
from app.db.database import SessionFactory
from app.db.models import Order


async def seed_orders() -> None:
    source = Path("/data/sample_orders.json")
    if not source.exists():
        source = Path(__file__).parents[3] / "data" / "sample_orders.json"
    rows = json.loads(source.read_text(encoding="utf-8"))
    async with SessionFactory() as session:
        for row in rows:
            statement = insert(Order).values(
                owner_id=DEMO_OWNER_ID,
                order_number=row["order_number"],
                status=row["status"],
                items=row["items"],
                created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00")),
            )
            await session.execute(
                statement.on_conflict_do_update(
                    index_elements=["owner_id", "order_number"],
                    set_={
                        "status": statement.excluded.status,
                        "items": statement.excluded["items"],
                        "updated_at": statement.excluded.updated_at,
                    },
                )
            )
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_orders())
