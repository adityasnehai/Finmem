import os
from openai import OpenAI
from finmem.data.schemas import QueryResult
from finmem.reasoning.confidence import confidence_gate

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are FinMem, a financial historian with access to a structured episodic memory of market history.

Rules:
1. Reason ONLY from the retrieved episodes provided. Never invent facts.
2. Cite each episode by date range when you reference it.
3. Include similarity score when citing an episode.
4. If you are uncertain, say so explicitly.
5. Keep responses concise — 3-5 sentences unless the user asks for more.
6. Always end with: "→ Source: [episode dates] · sim [score]"
"""


def _format_episodes(result: QueryResult) -> str:
    lines = ["RETRIEVED EPISODES (ranked by relevance):\n"]
    for i, r in enumerate(result.retrieved, 1):
        ep = r.episode
        outcome = ""
        if ep.spy_return_6m_after is not None:
            outcome = f"SPY 6m after: {ep.spy_return_6m_after:+.1%}"
        lines.append(
            f"[{i}] {ep.start_date} → {ep.end_date} | Regime: {ep.regime} | "
            f"Similarity: {r.final_score:.2f}\n"
            f"    VIX: {ep.vix_level:.1f} | CPI: {ep.cpi:.1f}% | Fed: {ep.fed_rate:.2f}% | "
            f"Yield curve: {ep.yield_spread:.2f}% | Unemp: {ep.unemployment:.1f}%\n"
            f"    Total return: {ep.total_return:+.1%} | Max drawdown: {ep.max_drawdown:.1%} | {outcome}\n"
            f"    Summary: {ep.prose_summary}\n"
        )
    return "\n".join(lines)


def reason(result: QueryResult, user_query: str, stream: bool = True):
    should_reason, prefix = confidence_gate(result)

    if not should_reason:
        return prefix

    episode_context = _format_episodes(result)
    user_content    = f"{prefix}{episode_context}\n\nUSER QUESTION: {user_query}"

    if stream:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=400,
            temperature=0.3,
            stream=True,
        )
        full = ""
        for chunk in response:
            delta = chunk.choices[0].delta.content or ""
            full += delta
            print(delta, end="", flush=True)
        print()
        return full
    else:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=400,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
