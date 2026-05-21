from finmem.data.schemas import QueryResult

# Calibrated for text-embedding-3-small + whitening: median pairwise sim ≈ 0, p75 ≈ 0.22, p90 ≈ 0.42
HIGH_THRESHOLD = 0.27
LOW_THRESHOLD  = 0.15

NO_ANALOG_MSG = (
    "No confident historical analog found (top similarity {sim:.2f}). "
    "Current conditions appear structurally distinct from the episode database — "
    "no historical period closely matches today's combination of macro and market signals."
)

UNCERTAIN_PREFIX = (
    "[Moderate confidence — similarity {sim:.2f}] "
    "The best matches are partial — treat this analysis as directional rather than definitive.\n\n"
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

    return False, NO_ANALOG_MSG.format(sim=sim)
