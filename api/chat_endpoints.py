"""FastAPI endpoints for Phase 4 chat interface"""

import os
import logging
from fastapi import FastAPI, HTTPException
from api.chat_schemas import ChatRequest, ChatResponse, ConversationSummary, ChatMessage
from api.query_parser import QueryParser
from api.response_formatter import ResponseFormatter
from api.chat_manager import ChatManager
from api.query_engine import QueryEngine
from api.reasoning import ReasoningEngine
from api.similarity_search import init_search_engine
from datetime import datetime

logger = logging.getLogger(__name__)

# Initialize components
chat_manager = ChatManager(max_history=30)
query_parser = QueryParser()
response_formatter = ResponseFormatter()

_query_engine = None
_reasoning_engine = None


def get_query_engine():
    global _query_engine
    if _query_engine is None:
        db_url = os.getenv('DATABASE_URL', 'postgresql://localhost/finmem')
        _query_engine = QueryEngine(db_url)
        _query_engine.connect()
    return _query_engine


def get_reasoning_engine():
    global _reasoning_engine
    if _reasoning_engine is None:
        _reasoning_engine = ReasoningEngine()
    return _reasoning_engine


app = FastAPI(title="FinMem Phase 4 - Chat Interface", version="1.0.0")


@app.on_event("shutdown")
async def shutdown_event():
    global _query_engine
    if _query_engine:
        _query_engine.close()


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Main chat endpoint
    
    POST /chat
    {
        "conversation_id": "conv_1234",
        "user_message": "What happens when volatility spikes?",
        "include_context": true,
        "include_risk_disclaimer": true
    }
    """
    try:
        init_search_engine()

        # Get or create conversation
        conv = chat_manager.get_conversation(request.conversation_id)
        if not conv:
            conv = chat_manager.create_conversation(request.conversation_id)

        # Add user message
        user_msg = ChatMessage(
            role="user",
            content=request.user_message,
            timestamp=datetime.now()
        )
        chat_manager.add_message(request.conversation_id, user_msg)

        # Parse query
        context = chat_manager.get_context(request.conversation_id)
        analysis = query_parser.parse(request.user_message, context)

        logger.info(f"Query analysis: type={analysis.query_type}, confidence={analysis.confidence}")

        # Check if clarification needed
        if analysis.needs_clarification and analysis.confidence < 0.5:
            clarification = query_parser.generate_clarification_follow_up(analysis)
            response_text = f"I want to make sure I understand correctly.\n\n{clarification}\n\nOnce I have these details, I can give you a better analysis."

            return ChatResponse(
                conversation_id=request.conversation_id,
                message=response_text,
                confidence_level="LOW",
                confidence_explanation="Need clarification to properly analyze query",
                similar_episodes_count=0,
                win_rate=0.0,
                avg_return_6m=0.0,
                median_return_6m=0.0,
                query_used=request.user_message,
                important_caveats=["Unable to analyze without additional information"]
            )

        # Update context
        chat_manager.update_context(request.conversation_id, analysis)
        user_pref = query_parser.extract_user_preference(request.user_message) or "balanced"

        # Get similar episodes based on query type
        engine = get_query_engine()
        total_episodes = engine.get_total_episodes()

        if analysis.query_type == "market_state":
            # Convert market state to text query
            query_text = _market_state_to_text(analysis.interpreted_market_state or {})
            similar_results = engine.semantic_search(
                query_text,
                top_k=5,
                min_confidence=analysis.confidence_threshold
            )

        elif analysis.query_type == "regime":
            # Query by regime (handled differently)
            similar_results = engine.semantic_search(
                f"episodes with {analysis.interpreted_regime} regime",
                top_k=10,
                min_confidence=0.0
            )
            # Filter by regime in database
            if analysis.interpreted_regime:
                similar_results = [r for r in similar_results if r['regime'] == analysis.interpreted_regime]

        else:  # natural_language
            similar_results = engine.semantic_search(
                request.user_message,
                top_k=5,
                min_confidence=analysis.confidence_threshold
            )

        # Build episode objects
        similar_episodes = engine.build_similar_episodes(similar_results, total_episodes)

        # Generate reasoning
        reasoning = get_reasoning_engine()
        reasoning_insight = reasoning.analyze_outcomes(similar_episodes, total_episodes)

        # Format response
        response = response_formatter.format_response(
            query=analysis.original_query,
            similar_episodes=similar_episodes,
            reasoning=reasoning_insight,
            user_preference=user_pref
        )

        # Set conversation ID and add to context
        response.conversation_id = request.conversation_id

        # Add to conversation findings
        if reasoning_insight.win_rate_pct > 60:
            conv.add_finding(f"Pattern shows {reasoning_insight.win_rate_pct:.0f}% win rate (bullish)")
        elif reasoning_insight.win_rate_pct < 50:
            conv.add_finding(f"Pattern shows {reasoning_insight.win_rate_pct:.0f}% win rate (cautious)")

        # Add assistant message
        assistant_msg = ChatMessage(
            role="assistant",
            content=response.message,
            timestamp=datetime.now()
        )
        chat_manager.add_message(request.conversation_id, assistant_msg)

        return response

    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/conversation/{conversation_id}", response_model=ConversationSummary)
async def get_conversation(conversation_id: str) -> ConversationSummary:
    """Get conversation summary"""
    return chat_manager.get_summary(conversation_id)


@app.get("/conversation/{conversation_id}/history")
async def get_history(conversation_id: str):
    """Get conversation history"""
    conv = chat_manager.get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation_id": conversation_id,
        "messages": [
            {
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat()
            }
            for m in conv.get_history()
        ]
    }


@app.get("/health/chat")
async def health_check_chat():
    """Check chat system health"""
    try:
        engine = get_query_engine()
        total_episodes = engine.get_total_episodes()

        return {
            "status": "ready",
            "chat_manager": "operational",
            "query_parser": "operational",
            "response_formatter": "operational",
            "episodes_available": total_episodes,
            "conversations_active": len(chat_manager.conversations)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }


def _market_state_to_text(market_state: dict) -> str:
    """Convert market state dict to text query"""
    parts = ["Current market state:"]

    if market_state.get('spy_price'):
        parts.append(f"SPY at {market_state['spy_price']:.0f}")
    if market_state.get('vix'):
        parts.append(f"VIX {market_state['vix']:.1f}")
    if market_state.get('cpi'):
        parts.append(f"CPI {market_state['cpi']:.2f}%")
    if market_state.get('fed_rate'):
        parts.append(f"Fed Rate {market_state['fed_rate']:.2f}%")
    if market_state.get('yield_spread') is not None:
        parts.append(f"Yield spread {market_state['yield_spread']:.2f}%")
    if market_state.get('unemployment'):
        parts.append(f"Unemployment {market_state['unemployment']:.2f}%")

    return ". ".join(parts)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
