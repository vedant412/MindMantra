import re

def analyze_speech(text: str, segments: list) -> dict:
    """
    Analyzes faster-whisper segments to detect pauses, fillers, speech rate, and calculate confidence.
    """
    if not segments:
        return {
            "pauses": 0,
            "fillers": 0,
            "speech_rate": 0.0,
            "confidence": 100
        }

    pauses = 0
    previous_end = 0.0
    
    # 1. Pause Detection
    for i, current in enumerate(segments):
        if i > 0:
            gap = current.start - previous_end
            if gap > 1.5:
                pauses += 1
        previous_end = current.end

    # 2. Filler Word Detection
    filler_words = {"um", "umm", "uh", "hmm", "like"}
    fillers = 0
    words = re.findall(r'\b\w+\b', text.lower())
    for w in words:
        if w in filler_words:
            fillers += 1

    # 3. Speech Rate (words per second)
    total_words = len(words)
    first_start = segments[0].start
    last_end = segments[-1].end
    total_duration = last_end - first_start
    
    speech_rate = total_words / total_duration if total_duration > 0 else 0.0

    # 4. Confidence Score
    confidence = 100
    confidence -= (pauses * 5)
    confidence -= (fillers * 3)
    if speech_rate > 0 and speech_rate < 1.5:
        confidence -= 10

    # Ensure score stays between 0-100
    confidence = max(0, min(100, confidence))

    return {
        "pauses": pauses,
        "fillers": fillers,
        "speech_rate": round(speech_rate, 2),
        "confidence": confidence
    }
