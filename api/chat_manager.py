"""Chat manager for conversation context and history"""

import logging
import json
from datetime import datetime
from typing import List, Optional, Dict
from collections import deque
from api.chat_schemas import (
    ChatMessage, ConversationContext, ConversationSummary,
    QueryAnalysis
)

logger = logging.getLogger(__name__)


class ChatManager:
    """Manage conversation history and context"""

    def __init__(self, max_history: int = 20):
        """
        Args:
            max_history: Maximum messages to keep in memory
        """
        self.conversations: Dict[str, 'Conversation'] = {}
        self.max_history = max_history

    def create_conversation(self, conversation_id: str) -> 'Conversation':
        """Create new conversation"""
        if conversation_id in self.conversations:
            logger.warning(f"Conversation {conversation_id} already exists")
            return self.conversations[conversation_id]

        conv = Conversation(conversation_id, self.max_history)
        self.conversations[conversation_id] = conv
        logger.info(f"Created conversation {conversation_id}")
        return conv

    def get_conversation(self, conversation_id: str) -> Optional['Conversation']:
        """Get existing conversation"""
        return self.conversations.get(conversation_id)

    def add_message(self, conversation_id: str, message: ChatMessage):
        """Add message to conversation"""
        conv = self.get_conversation(conversation_id)
        if not conv:
            conv = self.create_conversation(conversation_id)

        conv.add_message(message)

    def get_context(self, conversation_id: str) -> ConversationContext:
        """Get accumulated context from conversation"""
        conv = self.get_conversation(conversation_id)
        if not conv:
            return ConversationContext()

        return conv.context

    def update_context(self, conversation_id: str, analysis: QueryAnalysis):
        """Update context based on query analysis"""
        conv = self.get_conversation(conversation_id)
        if not conv:
            return

        conv.update_context(analysis)

    def get_summary(self, conversation_id: str) -> ConversationSummary:
        """Get conversation summary"""
        conv = self.get_conversation(conversation_id)
        if not conv:
            return ConversationSummary(
                conversation_id=conversation_id,
                created_at=datetime.now(),
                messages_count=0,
                context=ConversationContext(),
                last_message_timestamp=datetime.now(),
                key_findings=[],
                risk_level="MEDIUM"
            )

        return conv.get_summary()


class Conversation:
    """Single conversation thread"""

    def __init__(self, conversation_id: str, max_history: int = 20):
        self.conversation_id = conversation_id
        self.created_at = datetime.now()
        self.messages: deque = deque(maxlen=max_history)
        self.context = ConversationContext()
        self.key_findings: List[str] = []

    def add_message(self, message: ChatMessage):
        """Add message to conversation"""
        self.messages.append(message)
        logger.debug(f"Added {message.role} message to {self.conversation_id}")

    def get_history(self) -> List[ChatMessage]:
        """Get conversation history"""
        return list(self.messages)

    def get_recent_history(self, last_n: int = 5) -> List[ChatMessage]:
        """Get last N messages"""
        return list(self.messages)[-last_n:]

    def update_context(self, analysis: QueryAnalysis):
        """Update context based on query analysis"""
        # Update time horizon
        if analysis.time_horizon:
            self.context.preferred_horizon = analysis.time_horizon

        # Update regime preference
        if analysis.interpreted_regime:
            self.context.preferred_regime = analysis.interpreted_regime

        # Update confidence level
        if analysis.query_type != "clarification":
            self.context.last_query_type = analysis.query_type

        # Store clarification needs
        if analysis.clarification_questions:
            self.context.clarifications_needed = analysis.clarification_questions

    def add_finding(self, finding: str):
        """Add key finding to conversation"""
        self.key_findings.append(finding)

    def get_summary(self) -> ConversationSummary:
        """Get conversation summary"""
        return ConversationSummary(
            conversation_id=self.conversation_id,
            created_at=self.created_at,
            messages_count=len(self.messages),
            context=self.context,
            last_message_timestamp=self.messages[-1].timestamp if self.messages else datetime.now(),
            key_findings=self.key_findings,
            risk_level=self._assess_risk_level()
        )

    def _assess_risk_level(self) -> str:
        """Assess overall risk level from findings"""
        # Simple heuristic based on keywords in findings
        low_keywords = ['low', 'conservative', 'safe', 'stable']
        high_keywords = ['crash', 'recession', 'bear', 'risk', 'loss']

        findings_text = " ".join(self.key_findings).lower()

        high_count = sum(findings_text.count(kw) for kw in high_keywords)
        low_count = sum(findings_text.count(kw) for kw in low_keywords)

        if high_count > low_count:
            return "HIGH"
        elif low_count > high_count:
            return "LOW"
        else:
            return "MEDIUM"

    def export_json(self) -> str:
        """Export conversation to JSON"""
        messages = [
            {
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat()
            }
            for m in self.messages
        ]

        data = {
            "conversation_id": self.conversation_id,
            "created_at": self.created_at.isoformat(),
            "messages": messages,
            "context": self.context.dict(),
            "key_findings": self.key_findings
        }

        return json.dumps(data, indent=2)
