from finmem.data.schemas import QueryResult

HIGH_THRESHOLD = 0.65
LOW_THRESHOLD  = 0.45

NO_ANALOG_MSG = (
    "No confident historical analog found (top similarity {sim:.2f} < {thr:.2f}). "
    "Current conditions may be structurally novel — similar to COVID Feb 2020, "
    "which had no strong precedent. Retrieval refused to avoid hallucination."
)

UNCERTAIN_PREFIX = (
    "[Moderate confidence — similarity {sim:.2f}] The following analysis is based on "
    "partial matches and should be treated with caution.\n\n"
)


def confidence_gate(result: QueryResult) -> tuple[bool, str]:
    """
    Returns (should_reason, prefix_or_refusal_message).
    If should_reason is False, the string is the final response.
    If True, prepend the string to the LLM prompt context.
    """
    sim = result.confidence

    if sim >= HIGH_THRESHOLD:
        return True, ""

    if sim >= LOW_THRESHOLD:
        return True, UNCERTAIN_PREFIX.format(sim=sim)

    return False, NO_ANALOG_MSG.format(sim=sim, thr=LOW_THRESHOLD)
