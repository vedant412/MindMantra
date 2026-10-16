import json
import logging
import asyncio
from typing import Dict, Optional, Tuple, List, Any

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"

# Tunable constants
MAX_CHAT_EXCHANGES = 4        # Last N user↔AI pairs kept in prompt
MAX_INPUT_CHARS    = 300      # Truncate user_text before prompt building
LLM_TIMEOUT_SECS  = 10.0     # Hard timeout for Ollama HTTP call
LLM_SOFT_TIMEOUT  = 2.0      # Soft target (for fallback trigger in route)

FALLBACK_RESPONSES = {
    "en": ("Hmm... my brain is a little fuzzy right now. Want to try a quick breathing exercise?",
           "Can we try that again?", [{"type": "exercise", "id": "breathing"}]),
    "hi": ("उफ़... मेरा दिमाग थोड़ा उलझा हुआ है। क्या हम एक breathing exercise try करें?",
           "क्या हम फिर से try करें?", [{"type": "exercise", "id": "breathing"}]),
    "mr": ("अरे... माझं डोकं थोडं गोंधळलंय. एक breathing exercise करून बघूया का?",
           "परत प्रयत्न करूया का?", [{"type": "exercise", "id": "breathing"}]),
}


def _get_fallback(language: str, selected_question: str) -> tuple:
    fb = FALLBACK_RESPONSES.get(language, FALLBACK_RESPONSES["en"])
    q = selected_question if selected_question else fb[1]
    return fb[0], q, fb[2]


def _build_prompt(
    user_text: str,
    language: str,
    memory: Dict[str, Any],
    state: str,
    selected_question: str,
    emotion: Optional[str],
    cognitive_score: Optional[int],
    cognitive_state: Optional[str],
    sentiment: Optional[str],
    confidence: Optional[float],
    current_time: Optional[str],
    time_of_day: Optional[str],
    ask_time_q: bool,
    daily_summary: Optional[dict],
    recent_insights: Optional[List[str]],
) -> str:
    """Builds the full LLM prompt. Kept synchronous — pure string work."""

    # --- Token trimming: cap history to last MAX_CHAT_EXCHANGES pairs ---
    facts_str = "\n".join([f"* {k}: {v}" for k, v in memory.get("facts", {}).items()])

    events_list = memory.get("recent_events", [])
    events_str = ""
    if events_list:
        events_str = "Recent activities:\n" + "\n".join(
            [f"* {e['category']}: {e['value']}" for e in events_list]
        )

    # Only keep last MAX_CHAT_EXCHANGES exchanges to control token size
    recent_chats = memory.get("recent_chats", [])[-MAX_CHAT_EXCHANGES:]
    chat_lines = []
    for c in recent_chats:
        chat_lines.append(f"User: {c['user']}")
        chat_lines.append(f"AI: {c['ai']}")

    # Truncate current input to avoid runaway token counts
    safe_user_text = user_text[:MAX_INPUT_CHARS]
    chat_lines.append(f"User: {safe_user_text}")
    chats_str = "\n".join(chat_lines)

    advanced_context = ""
    if emotion and emotion != "neutral":
        is_mismatch = (sentiment == "positive" and emotion in ["stressed", "sad", "angry"])
        if (cognitive_score is not None and cognitive_score < 70) or is_mismatch:
            advanced_context = f"""
Observed emotion: {emotion} (based on facial expression)

User state:
* confidence: {confidence if confidence else 'Unknown'}
* sentiment: {sentiment if sentiment else 'Unknown'}
* cognitive_state: {cognitive_state}
"""

    daily_context = ""
    if daily_summary and daily_summary.get("interaction_count", 0) > 0:
        daily_context = f"""
User daily trend:
* today_score: {daily_summary.get('avg_score')}
* state: {daily_summary.get('state')}
Instruction: Use this macro context subtly in conversation.
"""

    insights_context = ""
    if recent_insights:
        insights_context = "Recent insights:\n" + "\n".join([f"* {i}" for i in recent_insights])
        insights_context += "\nInstruction: Use insights subtly when relevant. Do not force them into every response."

    length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be conversational."
    if emotion in ["stressed", "sad", "disgust", "fear"]:
        length_instruction = "Keep your response SHORT to MEDIUM (2-3 sentences max). Be highly supportive, empathetic, and gentle."
    elif emotion in ["happy", "surprise"]:
        length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be light and positive. Mirror their energy."

    lang_map = {"en": "English", "hi": "Hindi", "mr": "Marathi"}
    lang_name = lang_map.get(language, "English")

    lang_specific_instruction = ""
    if language == "mr":
        lang_specific_instruction = "CRITICAL: You MUST use pure Marathi vocabulary and grammar (e.g., use 'आहे', 'कसं', 'मी'). Do NOT mix Hindi words. You MUST write everything strictly in Devanagari script (देवनागरी)."
    elif language == "hi":
        lang_specific_instruction = "CRITICAL: You MUST use pure Hindi vocabulary and grammar. You MUST write everything strictly in Devanagari script (देवनागरी)."

    user_name = memory.get("facts", {}).get("Name", "Friend")

    prompt = f"""You are Vani, an empathetic AI companion. You are having a fluid, ongoing voice conversation with the user.

CORE PERSONALITY:
* ALWAYS RESPOND EXCLUSIVELY IN {lang_name.upper()}.
* Address the user casually and warmly by their name: {user_name}
* {lang_specific_instruction}
* {length_instruction}
* Always speak naturally ("yeah", "hmm", "I see") and use contractions.
* You are listening to them actively. DO NOT give long lists, bullet points, or paragraphs.
* AVOID robotic phrases ("Based on what you said", "As an AI").
* Max response length: 40 words. Less is always better for voice.

MEMORY CONTEXT - USE THIS TO YOUR ADVANTAGE:
Facts known about user:
{facts_str if facts_str else "None"}
{events_str}
{daily_context}

SESSION HISTORY (Read this to maintain conversation flow):
{chats_str}

RULES ON MEMORY:
* You MUST remember what we just talked about above.
* If they just answered your question, acknowledge it!
* Do NOT repeat facts back to them like a robot ("Oh, you slept late and ate pizza!"). Instead, use it as subtext ("Yeah, sleep always messes me up too.").
* ONLY use facts if it naturally fits the immediate conversation.

{advanced_context}

Time context: It is currently {current_time} ({time_of_day}).
{f"Ask a casual, friendly question relevant to the {time_of_day} if appropriate." if ask_time_q else ""}

CRITICAL INSTRUCTION: You MUST write your ENTIRE final reply in {lang_name}. Do NOT use English unless the requested language is English. Respond naturally taking into account the history, strictly in {lang_name} using the correct native script.

CRITICAL JSON OUTPUT REQUIREMENT:
You MUST output your response strictly as a valid JSON object matching this schema. Do not output markdown code blocks.
{{
  "text": "Your spoken conversational response here translated into {lang_name}",
  "actions": []
}} // Only add an action if clinically advised based on user state.

SUPPORTED ACTIONS (Use these IDs exactly if suggesting an activity):
Games: pattern, reaction, stroop, sequence
Exercises: breathing, meditation, stretching, journaling

CONTEXTUAL ACTION LOGIC:
- If stress detected: suggest {{"type": "exercise", "id": "breathing"}}
- If low activity: suggest {{"type": "game", "id": "pattern"}}
- If low memory: suggest {{"type": "game", "id": "sequence"}}
- If high screen time: suggest {{"type": "exercise", "id": "meditation"}}

Example JSON:
{{
  "text": "It sounds like you're stressed. Let's do a quick breathing exercise.",
  "actions": [{{"type": "exercise", "id": "breathing"}}]
}}"""

    if selected_question:
        prompt += f"\n\nYou MUST end your response by asking THIS specific question translated to {lang_name} (in native script): '{selected_question}'"

    return prompt


def _parse_llm_output(raw_output: str, selected_question: str) -> tuple:
    """Parse and post-process LLM JSON output. Returns (text, question, actions)."""
    # Strip markdown fences if present
    for prefix in ("```json", "```"):
        if raw_output.startswith(prefix):
            raw_output = raw_output[len(prefix):]
            break
    if raw_output.endswith("```"):
        raw_output = raw_output[:-3]
    raw_output = raw_output.strip()

    actions_list = []
    try:
        parsed_json = json.loads(raw_output)
        full_response = parsed_json.get("text", "")
        actions_list = parsed_json.get("actions", [])
    except json.JSONDecodeError:
        full_response = raw_output
        actions_list = []

    if not full_response:
        full_response = raw_output

    # Hard-stop word trimming (40 words max)
    words = full_response.split()
    if len(words) > 40:
        truncated = " ".join(words[:40])
        cut_index = max(truncated.rfind("."), truncated.rfind("?"), truncated.rfind("!"))
        if cut_index > 10:
            full_response = truncated[:cut_index + 1]
        else:
            full_response = truncated + "..."
        if selected_question and selected_question not in full_response:
            full_response += f" {selected_question}"

    # Extract generated question if none was provided
    generated_q = selected_question
    if not selected_question:
        sentences = full_response.replace('\n', ' ').split('.')
        for s in reversed(sentences):
            if '?' in s:
                generated_q = s.strip() + '?'
                break
        if not generated_q:
            generated_q = "What's been going on?"

    return full_response, generated_q, actions_list


async def generate_response(
    user_text: str,
    language: str = "en",
    memory: Optional[Dict[str, Any]] = None,
    state: str = "normal",
    selected_question: str = "",
    emotion: Optional[str] = None,
    cognitive_score: Optional[int] = None,
    cognitive_state: Optional[str] = None,
    sentiment: Optional[str] = None,
    confidence: Optional[float] = None,
    current_time: Optional[str] = None,
    time_of_day: Optional[str] = None,
    ask_time_q: bool = False,
    daily_summary: Optional[dict] = None,
    recent_insights: Optional[List[str]] = None
) -> Tuple[str, str, list]:
    """
    Async LLM response generator using httpx.
    Returns (response_text, generated_question, actions_array).
    Falls back gracefully on timeout or error.
    """
    if memory is None:
        memory = {}

    prompt = _build_prompt(
        user_text=user_text,
        language=language,
        memory=memory,
        state=state,
        selected_question=selected_question,
        emotion=emotion,
        cognitive_score=cognitive_score,
        cognitive_state=cognitive_state,
        sentiment=sentiment,
        confidence=confidence,
        current_time=current_time,
        time_of_day=time_of_day,
        ask_time_q=ask_time_q,
        daily_summary=daily_summary,
        recent_insights=recent_insights,
    )

    payload = {
        "model": "mistral",
        "prompt": prompt,
        "stream": False
    }

    try:
        import httpx
        async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECS) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
            data = response.json()
            raw_output = data.get("response", "").strip()
            return _parse_llm_output(raw_output, selected_question)

    except Exception as e:
        logger.warning(f"[LLM] Ollama error: {type(e).__name__}: {e}")
        return _get_fallback(language, selected_question)
