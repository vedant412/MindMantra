def determine_state(text: str, sentiment: str, confidence: int = None) -> str:
    """
    Basic rule-based state detection enhanced with confidence score.
    """
    text_lower = text.lower()
    
    if confidence is not None and confidence < 60:
        if sentiment == "negative":
            return "stressed"
        return "low_confidence"
        
    if "tired" in text_lower or "exhausted" in text_lower:
        return "fatigue"
        
    if sentiment == "negative":
        return "stressed"
        
    return "normal"
