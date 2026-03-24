from sqlalchemy.orm import Session
from app.models.schemas import CognitiveHistory, UserEvent, DailyQuestion, UserInsight
from collections import Counter
from datetime import datetime, timezone, timedelta, date
from typing import Optional

def get_user_day_data(db: Session, user_id: str, target_date: Optional[date] = None) -> dict:
    if target_date is None:
        target_date = datetime.now(timezone.utc).date()
        
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    # 1. Cognitive Logs
    logs = db.query(CognitiveHistory).filter(
        CognitiveHistory.user_id == user_id,
        CognitiveHistory.timestamp >= start_of_day,
        CognitiveHistory.timestamp <= end_of_day
    ).all()
    
    avg_score = int(sum(l.score for l in logs if l.score is not None) / len(logs)) if logs else 0
    emotions = [l.emotion for l in logs if l.emotion and l.emotion != "neutral"]
    dominant_emotion = Counter(emotions).most_common(1)[0][0] if emotions else "neutral"
    
    evening_logs = [l for l in logs if l.timestamp.hour >= 17]
    morning_logs = [l for l in logs if l.timestamp.hour < 12]
    
    evening_avg = int(sum(l.score for l in evening_logs if l.score is not None) / len(evening_logs)) if evening_logs else avg_score
    morning_avg = int(sum(l.score for l in morning_logs if l.score is not None) / len(morning_logs)) if morning_logs else avg_score
    
    # 2. Activity Events
    events = db.query(UserEvent).filter(
        UserEvent.user_id == user_id,
        UserEvent.timestamp >= start_of_day,
        UserEvent.timestamp <= end_of_day
    ).all()
    activities = [e.category for e in events]
    
    # 3. DB Questions memory mapping
    answers = db.query(DailyQuestion).filter(
        DailyQuestion.user_id == user_id,
        DailyQuestion.answered == True,
        DailyQuestion.answer_time >= start_of_day,
        DailyQuestion.answer_time <= end_of_day
    ).all()
    answer_texts = [a.answer_text.lower() for a in answers if a.answer_text]
    
    return {
        "avg_score": avg_score,
        "dominant_emotion": dominant_emotion,
        "activities": activities,
        "answers": answer_texts,
        "evening_avg": evening_avg,
        "morning_avg": morning_avg
    }

def detect_patterns(data: dict) -> list[str]:
    patterns: list[str] = []
    
    avg_score = data["avg_score"]
    emotion = data["dominant_emotion"]
    activities = data["activities"]
    answers = data["answers"]
    
    # RULE 1: Work Stress
    if emotion == "stressed" and "work" in activities:
        patterns.append("work_stress")
        
    # RULE 2: Sleep Impact
    poor_sleep_keywords = ["badly", "poorly", "didn't", "no", "terrible", "late"]
    has_poor_sleep = any(kw in ans for ans in answers for kw in poor_sleep_keywords)
    if has_poor_sleep and avg_score > 0 and avg_score < 60:
        patterns.append("sleep_impact")
        
    # RULE 3: Exercise Positive Pattern Matching
    if "exercise" in activities and avg_score > 70:
        patterns.append("exercise_positive")
        
    # RULE 4: Evening Stress Fatigue
    if data["evening_avg"] > 0 and data["morning_avg"] > 0 and data["evening_avg"] < data["morning_avg"] - 10:
        patterns.append("evening_stress")
        
    # RULE 5: Low Engagement Isolation 
    if not activities and emotion in ["stressed", "sad", "fatigue"]:
        patterns.append("low_engagement")
        
    return patterns

def generate_and_store_insights(db: Session, user_id: str):
    """Detects active telemetry constants, generates human insight text strings, and deduplicates to DB."""
    data = get_user_day_data(db, user_id)
    patterns = detect_patterns(data)
    
    insight_map = {
        "work_stress": "Work might be putting a bit of pressure on you lately.",
        "sleep_impact": "Not getting enough sleep seems to be affecting your energy.",
        "exercise_positive": "You seem to feel better on days you're active.",
        "evening_stress": "Evenings seem a bit tougher for you.",
        "low_engagement": "You've been a bit inactive lately... maybe try something light?"
    }
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Impose a strict boundary rule capping maximum insights at 2 per temporal cycle
    for pat in (patterns[i] for i in range(min(2, len(patterns)))):
        text = insight_map.get(pat)
        if not text: continue
        
        # Deduplication scanning
        exists = db.query(UserInsight).filter(
            UserInsight.user_id == user_id,
            UserInsight.pattern_type == pat,
            UserInsight.timestamp >= today_start
        ).first()
        
        if not exists:
            insight = UserInsight(
                user_id=user_id,
                insight_text=text,
                pattern_type=pat
            )
            db.add(insight)
            
    db.commit()

def get_recent_insights(db: Session, user_id: str) -> list:
    """Provides LLM-accessible prompt injection points to reference aggregated day rulesets."""
    recent_limit = datetime.now(timezone.utc) - timedelta(days=2)
    insights = db.query(UserInsight).filter(
        UserInsight.user_id == user_id,
        UserInsight.timestamp >= recent_limit
    ).order_by(UserInsight.timestamp.desc()).limit(3).all()
    
    return [i.insight_text for i in insights]
