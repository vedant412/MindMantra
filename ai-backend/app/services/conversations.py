from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert
from app.models.domain import Conversation, Message, Profile, BackgroundJob, now

def owned_conversation(db, user_id, conversation_id):
    row = db.scalar(select(Conversation).where(Conversation.id == conversation_id, Conversation.user_id == user_id, Conversation.expires_at > now()).with_for_update())
    if not row:
        raise HTTPException(404, "Conversation not found")
    return row

def create_conversation(db, user_id, language, channel="text"):
    profile = db.get(Profile, user_id)
    row = Conversation(user_id=user_id, language=language, channel=channel, expires_at=now() + timedelta(days=profile.retention_days))
    db.add(row)
    db.flush()
    return row

def store_messages(db, user_id, conversation_id, turns, event_id, interrupted=False):
    conversation = owned_conversation(db, user_id, conversation_id)
    profile = db.get(Profile, user_id)
    if not profile.transcript_storage_enabled:
        return False
    sequence = db.scalar(select(func.coalesce(func.max(Message.sequence_no), 0)).where(Message.conversation_id == conversation_id, Message.user_id == user_id))
    for role, content in turns:
        if not content.strip():
            continue
        key = f"{event_id}:{role}"
        if db.scalar(select(Message.id).where(Message.user_id == user_id, Message.conversation_id == conversation_id, Message.provider_event_id == key)):
            continue
        sequence += 1
        db.add(Message(user_id=user_id, conversation_id=conversation_id, sequence_no=sequence, role=role, content_text=content[:8000], language=conversation.language,
                       interrupted=interrupted and role == "assistant", provider_event_id=key, expires_at=conversation.expires_at))
    db.flush()
    if profile.memory_enabled and sequence:
        db.execute(insert(BackgroundJob).values(user_id=user_id, conversation_id=conversation_id, source_revision=sequence, expires_at=conversation.expires_at).on_conflict_do_nothing())
    return True
