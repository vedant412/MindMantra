from typing import Dict, List, Tuple

# Rolling memory chunk to stabilize Face-API emotions
# Keys = session_ids, Values = Lists of last 5 emotions
active_sessions: Dict[str, List[str]] = {}

def get_stable_emotion(session_id: str, current_emotion: str) -> str:
    """Stores emotion history and returns the dominant emotion if stable."""
    if session_id not in active_sessions:
        active_sessions[session_id] = []
        
    if current_emotion:
        active_sessions[session_id].append(current_emotion)
        if len(active_sessions[session_id]) > 5:
            active_sessions[session_id].pop(0)
            
    # Stabilize: If emotion is not neutral and appears >= 3 times
    counts = {}
    for emo in active_sessions[session_id]:
        if emo != "neutral":
            counts[emo] = counts.get(emo, 0) + 1
            
    for emo, count in counts.items():
        if count >= 3:
            return emo
            
    return "neutral"

def calculate_cognitive_score(session_id: str, confidence: float, sentiment: str, raw_emotion: str) -> Tuple[int, str, str]:
    """Calculates combined cognitive score from audio-visual NLP factors."""
    stable_emotion = get_stable_emotion(session_id, raw_emotion)
    score = 100
    
    # Analyze Speech Confidence Drops
    if confidence is not None:
        if confidence < 40:
            score -= 30
        elif confidence < 60:
            score -= 20
            
    # Analyze Sentiment Drops
    if sentiment == "negative":
        score -= 20
        
    # Analyze Visual Dissonance
    if stable_emotion == "stressed":
        score -= 25
    elif stable_emotion == "sad":
        score -= 20
        
    # Floor / Ceil
    score = max(0, min(100, score))
    
    # State mapping
    if score >= 80:
        state = "normal"
    elif score >= 60:
        state = "mild_stress"
    elif score >= 40:
        state = "stressed"
    else:
        state = "high_stress"
        
    return score, state, stable_emotion

def check_mismatch(text_sentiment: str, stable_emotion: str) -> bool:
    """Detects dissonance if user speaks positively but looks stressed or sad."""
    if text_sentiment == "positive" and stable_emotion in ["stressed", "sad", "angry"]:
        return True
    return False
