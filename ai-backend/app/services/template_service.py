"""
template_service.py
-------------------
Instant response templates for common intents.
Avoids any LLM call — returns in < 20ms.

Supported intents: stress, sleep, low_activity, greeting
Returns None if no template matches → caller falls through to LLM.
"""

from typing import Optional, Tuple, List, Dict, Any
import random

# ---------------------------------------------------------------------------
# Keyword → Intent mapping
# ---------------------------------------------------------------------------
_INTENT_KEYWORDS: Dict[str, List[str]] = {
    "stress": [
        "stressed", "anxious", "anxiety", "overwhelmed", "panic",
        "tense", "nervous", "pressure", "burnout", "exhausted"
    ],
    "sleep": [
        "can't sleep", "cant sleep", "insomnia", "tired", "sleep",
        "sleepy", "awake", "night", "fatigue", "drowsy", "rest"
    ],
    "low_activity": [
        "bored", "boredom", "nothing to do", "lazy", "inactive",
        "sitting", "dull", "unproductive", "stuck"
    ],
    "greeting": [
        "hi", "hello", "hey", "good morning", "good night",
        "good evening", "what's up", "wassup", "how are you", "howdy"
    ],
}

# ---------------------------------------------------------------------------
# Templates per intent per language
# ---------------------------------------------------------------------------
_TEMPLATES: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "stress": {
        "en": [
            {
                "text": "Hey, I can sense you're feeling stressed. Let's take a slow breath together — it helps more than you think.",
                "actions": [{"type": "exercise", "id": "breathing"}]
            },
            {
                "text": "You seem a bit overwhelmed. A quick breathing exercise can really reset your mind.",
                "actions": [{"type": "exercise", "id": "breathing"}]
            },
        ],
        "hi": [
            {
                "text": "अरे, लगता है तुम थोड़ा stressed हो। चलो एक गहरी सांस लेते हैं — इससे बहुत फर्क पड़ता है।",
                "actions": [{"type": "exercise", "id": "breathing"}]
            },
        ],
        "mr": [
            {
                "text": "अरे, तुम्हाला थोडं तणाव जाणवतंय का? चला एक दीर्घ श्वास घेऊया — खूप फरक पडतो.",
                "actions": [{"type": "exercise", "id": "breathing"}]
            },
        ],
    },
    "sleep": {
        "en": [
            {
                "text": "Sleep troubles are rough. A short meditation before bed can make a real difference — want to try?",
                "actions": [{"type": "exercise", "id": "meditation"}]
            },
            {
                "text": "Sounds like rest is on your mind. Let's do a calming meditation to help you wind down.",
                "actions": [{"type": "exercise", "id": "meditation"}]
            },
        ],
        "hi": [
            {
                "text": "नींद की परेशानी समझ में आती है। एक छोटा meditation try करो, काफी helpful होता है।",
                "actions": [{"type": "exercise", "id": "meditation"}]
            },
        ],
        "mr": [
            {
                "text": "झोपेची समस्या कठीण असते. एक छोटं meditation करून बघ — खूप आराम मिळतो.",
                "actions": [{"type": "exercise", "id": "meditation"}]
            },
        ],
    },
    "low_activity": {
        "en": [
            {
                "text": "Feeling a bit low-energy? Let's wake your brain up with a quick pattern game!",
                "actions": [{"type": "game", "id": "pattern"}]
            },
            {
                "text": "Sometimes boredom just needs a spark. Try a fun pattern challenge to get your mind going.",
                "actions": [{"type": "game", "id": "pattern"}]
            },
        ],
        "hi": [
            {
                "text": "थोड़ा bored लग रहे हो? चलो एक pattern game खेलते हैं — मज़ा आएगा!",
                "actions": [{"type": "game", "id": "pattern"}]
            },
        ],
        "mr": [
            {
                "text": "थोडं कंटाळलेलं वाटतंय का? चला एक pattern game खेळूया — मस्त वाटेल!",
                "actions": [{"type": "game", "id": "pattern"}]
            },
        ],
    },
    "greeting": {
        "en": [
            {
                "text": "Hey there! Great to hear from you. How's your day going so far?",
                "actions": []
            },
            {
                "text": "Hi! Good to see you. What's on your mind today?",
                "actions": []
            },
        ],
        "hi": [
            {
                "text": "अरे, नमस्ते! आज कैसा दिन जा रहा है?",
                "actions": []
            },
        ],
        "mr": [
            {
                "text": "अरे, नमस्कार! आज कसं वाटतंय?",
                "actions": []
            },
        ],
    },
}


def detect_intent(user_text: str) -> Optional[str]:
    """
    Returns the first matched intent keyword, or None.
    Short-circuits on first match for speed.
    """
    lowered = user_text.lower().strip()

    # Only apply templates to short inputs (≤ 80 chars)
    if len(lowered) > 80:
        return None

    for intent, keywords in _INTENT_KEYWORDS.items():
        for kw in keywords:
            if kw in lowered:
                return intent
    return None


def get_template_response(
    user_text: str,
    language: str = "en",
    user_name: str = "Friend"
) -> Optional[Tuple[str, str, List]]:
    """
    Returns (response_text, question, actions) from a template, or None if no match.

    Usage in route:
        result = get_template_response(text, detected_lang)
        if result:
            text, question, actions = result
            return immediately  # skip LLM entirely
    """
    intent = detect_intent(user_text)
    if intent is None:
        return None

    lang_templates = _TEMPLATES.get(intent, {})
    # Fallback to English if language not supported
    templates = lang_templates.get(language) or lang_templates.get("en", [])

    if not templates:
        return None

    chosen = random.choice(templates)
    response_text = chosen["text"].replace("Friend", user_name)
    actions = chosen.get("actions", [])

    # Generate a contextual follow-up question
    question_map = {
        "stress": "What do you think is causing the most stress right now?",
        "sleep": "How many hours of sleep did you get last night?",
        "low_activity": "When did you last go for a walk or do something active?",
        "greeting": "What's been on your mind lately?",
    }
    question = question_map.get(intent, "How are you feeling?")

    return response_text, question, actions
