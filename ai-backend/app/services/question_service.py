from sqlalchemy.orm import Session
from app.models.schemas import DailyQuestion
from datetime import datetime, timezone, timedelta
import random

QUESTIONS_POOL = {
    "morning": [
        ("Did you sleep well?", "sleep"),
        ("How did you sleep last night?", "sleep"),
        ("Did you get enough rest?", "sleep")
    ],
    "afternoon": [
        ("What did you eat today?", "food"),
        ("Have you had lunch yet?", "food"),
        ("Did you eat anything good today?", "food")
    ],
    "evening": [
        ("Did you do anything active today?", "activity"),
        ("Have you been moving around much today?", "activity"),
        ("Did you get any exercise in today?", "activity")
    ],
    "night": [
        ("How are you feeling today?", "mood"),
        ("Was today a good day for you?", "mood"),
        ("Are you ready to wind down for the night?", "mood")
    ]
}

def can_ask_question(db: Session, user_id: str) -> bool:
    """Limits users to a max of 3 questions per day."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    count = db.query(DailyQuestion).filter(
        DailyQuestion.user_id == user_id,
        DailyQuestion.asked_at >= today_start
    ).count()
    
    return count < 3

def get_next_question(db: Session, user_id: str, time_of_day: str) -> tuple[str, str]:
    """
    Returns (question, question_type)
    Occasionally triggers a random daily question mapped to the time_of_day.
    """
    if not can_ask_question(db, user_id):
        return ("", "generated")
        
    # ~35% probability to ask a question if allowed
    if random.random() > 0.35:
        return ("", "generated")
        
    # Pick a random question from the current time category
    pool = QUESTIONS_POOL.get(time_of_day, QUESTIONS_POOL["night"])
    selected_tuple = random.choice(pool)
    q_text = selected_tuple[0]
    q_category = selected_tuple[1]
    
    # Ensure this exact question hasn't been asked today to prevent annoying repetition
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    already_asked = db.query(DailyQuestion).filter(
        DailyQuestion.user_id == user_id,
        DailyQuestion.question == q_text,
        DailyQuestion.asked_at >= today_start
    ).first()
    
    if already_asked:
        return ("", "generated")
        
    # Lock the selected question into the Database memory structure
    new_q = DailyQuestion(
        user_id=user_id,
        question=q_text,
        category=q_category,
        answered=False
    )
    db.add(new_q)
    db.commit()
    
    return (q_text, "required")

def detect_answer(db: Session, user_id: str, text: str):
    """
    If the user has an unanswered question pending in SQLite, we trap their current 
    speech transcript and flag it as the answer string, ensuring Vani 'remembers' it.
    """
    if not text:
        return
        
    # Look backward through time for the most recent unacknowledged question
    pending_q = db.query(DailyQuestion).filter(
        DailyQuestion.user_id == user_id,
        DailyQuestion.answered == False
    ).order_by(DailyQuestion.asked_at.desc()).first()
    
    if pending_q:
        pending_q.answered = True
        pending_q.answer_text = text
        pending_q.answer_time = datetime.now(timezone.utc)
        db.commit()
