import re
from sqlalchemy.orm import Session
from app.models.schemas import Conversation, UserFact, CognitiveHistory, UserEvent
from typing import List, Dict
from collections import Counter
from datetime import datetime, date, timedelta, timezone

def get_user_memory(db: Session, user_id: str, session_id: str) -> Dict[str, any]:
    """Fetches user facts, recent events, and recent conversations."""
    facts = db.query(UserFact).filter(UserFact.user_id == user_id).all()
    # Fetch last 10 messages for short-term memory limit
    recent_chats = db.query(Conversation).filter(
        Conversation.user_id == user_id,
        Conversation.session_id == session_id
    ).order_by(Conversation.timestamp.desc()).limit(10).all()
    
    # Reverse to get chronological order for prompt
    recent_chats.reverse()
    
    recent_events = db.query(UserEvent).filter(
        UserEvent.user_id == user_id
    ).order_by(UserEvent.timestamp.desc()).limit(5).all()
    
    return {
        "facts": {fact.key: fact.value for fact in facts},
        "recent_chats": [{"user": c.user_text, "ai": c.ai_response} for c in recent_chats],
        "recent_events": [{"category": e.category, "value": e.value} for e in recent_events]
    }

def extract_user_events(text: str) -> List[Dict[str, str]]:
    """Simple robust NLP scraping intercepting action strings from the user stream."""
    events = []
    text_lower = text.lower()
    
    # Food
    food_match = re.search(r'\b(ate|eat|eating|had)\s+(a\s+)?(\w+(?:\s+\w+)?)', text_lower)
    if food_match:
        val = food_match.group(3).strip()
        if val not in ["to", "a", "some"]:
            events.append({"category": "food", "value": val})
            
    # Exercise
    ex_match = re.search(r'\b(run|gym|workout|exercise|walk)\b', text_lower)
    if ex_match:
        events.append({"category": "exercise", "value": ex_match.group(1)})
        
    # Sleep
    sl_match = re.search(r'\b(slept|sleep|woke up)\s+(late|early|well|badly|poorly)?', text_lower)
    if sl_match:
        val = sl_match.group(2) if sl_match.group(2) else sl_match.group(1)
        events.append({"category": "sleep", "value": val})
        
    # Work
    wk_match = re.search(r'\b(work|studied|office|meeting)\b', text_lower)
    if wk_match:
        events.append({"category": "work", "value": wk_match.group(1)})
        
    # Entertainment
    ent_match = re.search(r'\b(watched|netflix|movie|game)\b', text_lower)
    if ent_match:
        events.append({"category": "entertainment", "value": ent_match.group(1)})
        
    return events

def store_user_events(db: Session, user_id: str, events: List[Dict[str, str]]):
    """Saves explicit events to SQLite securely while enforcing a short deduplication delay."""
    if not events:
        return
        
    delay_limit = datetime.now(timezone.utc) - timedelta(hours=3)
    
    for ev in events:
        cat = ev["category"]
        val = ev["value"]
        
        # Guard against duplicated events matching category and value within identical 3-hour chunks
        is_dup = db.query(UserEvent).filter(
            UserEvent.user_id == user_id,
            UserEvent.category == cat,
            UserEvent.value == val,
            UserEvent.timestamp >= delay_limit
        ).first()
        
        if not is_dup:
            new_ev = UserEvent(user_id=user_id, category=cat, value=val)
            db.add(new_ev)
            
    db.commit()

def extract_and_store_facts(db: Session, user_id: str, text: str):
    """Rule-based fact extraction."""
    text_lower = text.lower()
    new_facts = {}
    
    patterns = [
        (r"i ate\s+(.+)", "food"),
        (r"i feel\s+(.+)", "mood"),
        (r"i slept\s+(.+)", "sleep"),
        (r"my name is\s+(.+)", "name"),
        (r"i live in\s+(.+)", "location")
    ]
    
    for pattern, key in patterns:
        match = re.search(pattern, text_lower)
        if match:
            # Clean up trailing punctuation
            value = re.split(r'[.,;!]', match.group(1))[0].strip()
            new_facts[key] = value

    # Store into DB
    for key, value in new_facts.items():
        existing_fact = db.query(UserFact).filter(UserFact.user_id == user_id, UserFact.key == key).first()
        if existing_fact:
            existing_fact.value = value
        else:
            fact = UserFact(user_id=user_id, key=key, value=value)
            db.add(fact)
    
    if new_facts:
        db.commit()

def store_conversation(db: Session, user_id: str, session_id: str, user_text: str, ai_response: str):
    """Stores the conversation turn into the database."""
    conversation = Conversation(
        user_id=user_id,
        session_id=session_id,
        user_text=user_text,
        ai_response=ai_response
    )
    db.add(conversation)
    db.commit()

def store_cognitive_history(db: Session, user_id: str, session_id: str, score: int, state: str, emotion: str = None, confidence: float = None):
    """Stores the calculated cognitive score and state securely into the database."""
    history = CognitiveHistory(
        user_id=user_id,
        session_id=session_id,
        score=score,
        state=state,
        emotion=emotion,
        confidence=confidence
    )
    db.add(history)
    db.commit()

def generate_insight(summary: dict) -> str:
    """Rule-based engine returning empathetic human summary strings."""
    score = summary["avg_score"]
    emotion = summary["dominant_emotion"]
    evening_drop = summary.get("evening_drop", False)
    
    insight = ""
    if score < 50:
        insight = "You seemed quite stressed today... try to get some rest."
    elif score <= 70:
        insight = "You had a slightly stressful day... take it easy."
    else:
        insight = "You seemed pretty balanced today... nice going."
        
    if emotion == "stressed":
        insight += " You looked a bit tense at times."
        
    if evening_drop:
        insight += " You seemed more tired in the evening."
        
    return insight

def get_daily_summary(db: Session, user_id: str, target_date: date = None) -> dict:
    """Combines thousands of daily data points into a single conversational context array."""
    if not target_date:
        target_date = datetime.now().date()
        
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    logs = db.query(CognitiveHistory).filter(
        CognitiveHistory.user_id == user_id,
        CognitiveHistory.timestamp >= start_of_day,
        CognitiveHistory.timestamp <= end_of_day
    ).all()
    
    interaction_count = len(logs)
    if interaction_count == 0:
        return {
            "avg_score": 0,
            "state": "unknown",
            "dominant_emotion": "neutral",
            "interaction_count": 0,
            "insight": "No data available for today."
        }
        
    avg_score = int(sum(log.score for log in logs if log.score is not None) / interaction_count)
    
    emotions = [log.emotion for log in logs if log.emotion and log.emotion != "neutral"]
    dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else "neutral"
    
    states = [log.state for log in logs if log.state]
    most_common_state = Counter(states).most_common(1)[0][0] if states else "normal"
    
    # Analyze if the user exhibits steep fatigue drop-off
    evening_logs = [log for log in logs if log.timestamp.hour >= 17]
    evening_avg = sum(log.score for log in evening_logs if log.score is not None) / len(evening_logs) if evening_logs else avg_score
    
    summary = {
        "avg_score": avg_score,
        "state": most_common_state,
        "dominant_emotion": dominant_emotion,
        "interaction_count": interaction_count,
        "evening_drop": evening_avg < avg_score - 10
    }
    
    summary["insight"] = generate_insight(summary)
    return summary
