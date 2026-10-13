from app.agent.router import route_message


def test_routes_order_status_with_identifier_to_tool() -> None:
    decision = route_message("Can you check the shipping status for ord-1002?")

    assert decision.route == "order"
    assert decision.order_number == "ORD-1002"


def test_plain_document_question_uses_rag() -> None:
    assert route_message("What is the return window?").route == "rag"


def test_order_without_identifier_uses_safe_default() -> None:
    assert route_message("Where is my order?").route == "rag"


def test_order_identifier_alone_routes_to_database() -> None:
    assert route_message("Where is ORD-1002?").route == "order"
