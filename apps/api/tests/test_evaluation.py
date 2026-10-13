from app.evaluation import answer_overlap


def test_answer_overlap_ignores_common_words_and_rewards_gold_facts() -> None:
    expected = "An eligible item may be returned within 30 days of delivery."

    assert (
        answer_overlap(
            "Eligible items can be returned within 30 days of delivery.", expected
        )
        > 0.7
    )
    assert answer_overlap("The policy discusses delivery.", expected) < 0.45
