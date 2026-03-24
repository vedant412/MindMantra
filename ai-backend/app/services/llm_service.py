import requests
from typing import Dict

OLLAMA_URL = "http://localhost:11434/api/generate"

def generate_response(
    user_text: str, 
    memory: Dict, 
    state: str, 
    selected_question: str, 
    emotion: str = None,
    cognitive_score: int = None,
    cognitive_state: str = None,
    sentiment: str = None,
    confidence: float = None,
    current_time: str = None,
    time_of_day: str = None,
    ask_time_q: bool = False,
    daily_summary: dict = None,
    recent_insights: list = None
) -> tuple[str, str]:
    """
    Generates a response using Ollama API.
    Returns (response_text, generated_question)
    """
    facts_str = "\n".join([f"* {k}: {v}" for k, v in memory.get("facts", {}).items()])
    
    events_str = ""
    events_list = memory.get("recent_events", [])
    if events_list:
        events_str = "Recent activities:\n" + "\n".join([f"* {e['category']}: {e['value']}" for e in events_list])
    
    # Build recent conversation string
    recent_chats = memory.get("recent_chats", [])
    chat_lines = []
    for c in recent_chats:
        chat_lines.append(f"User: {c['user']}")
        chat_lines.append(f"AI: {c['ai']}")
        
    # Append the current input
    chat_lines.append(f"User: {user_text}")
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
        
    length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be brief."
    if emotion in ["stressed", "sad", "disgust", "fear"]:
        length_instruction = "Keep your response SHORT to MEDIUM (2-3 sentences max). Be highly supportive, gentle, and calm."
    elif emotion in ["happy", "surprise"]:
        length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be light and positive. Do not over-explain."

    prompt = f"""You are Vani, a friendly and emotionally aware companion.

You talk like a real person, not an AI.
Your tone is casual, warm, slightly informal, and supportive.

CORE PERSONALITY:
* {length_instruction}
* Use natural phrasing ("yeah", "hmm", "I get that") and contractions ("you're", "it's").
* Use human-like pauses ("...") and short breaks.
* Be slightly unsure occasionally (e.g., "Hmm... that sounds a bit rough").
* DO NOT be overly formal, overly verbose, or robotic.
* AVOID AI phrases like "Based on your input", "It appears that", or "I understand your concern".
* NEVER use lists, bullet points, or long paragraphs.
* MAX LENGTH ALARM: Your entire response MUST be under 40 words.

RULES:
* Do not always ask a question. Mix observations with short responses.
* When asking questions, use highly contextual ones like "Did you sleep okay?" instead of generic "How are you feeling today?"
* PREFER asking 1 simple question over giving a long explanation.
* You understand the user through text, voice patterns, and emotion detection.
* NEVER say "I can't see you" or deny emotional awareness.
* You are aware of the user's state when provided.

User facts:
{facts_str if facts_str else "None"}
{events_str}
{advanced_context}
{daily_context}
{insights_context}
Current session conversation:
{chats_str}

Time context: It is currently {current_time} ({time_of_day}).
{f"Instruction: Consider asking a casual summary question relevant to the {time_of_day} (e.g. sleep, meals, how their day is going) if it fits the conversation naturally." if ask_time_q else "Use time awareness subtly. Only ask time-related questions if naturally appropriate."}

Respond like a real person having a casual conversation."""
    
    # In case there's a specialized DB question to ask
    if selected_question:
        prompt += f"\n\nYou MUST end your response by asking THIS specific question: '{selected_question}'"

    payload = {
        "model": "mistral", # standard model placeholder
        "prompt": prompt,
        "stream": False
    }
    
    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        full_response = data.get("response", "").strip()
        
        # Hard-Stop Word Trimming Post-Processor
        words = full_response.split()
        if len(words) > 40:
            truncated = " ".join(words[:40])
            last_period = truncated.rfind(".")
            last_question = truncated.rfind("?")
            last_exclaim = truncated.rfind("!")
            
            cut_index = max(last_period, last_question, last_exclaim)
            if cut_index > 10:
                full_response = truncated[:cut_index+1]
            else:
                full_response = truncated + "..."
                
            # Safely re-inject memory question if it was severed
            if selected_question and selected_question not in full_response:
                full_response += f" {selected_question}"
        
        # Extract generated question if needed
        generated_q = selected_question
        if not selected_question:
            sentences = full_response.replace('\n', ' ').split('.')
            for s in reversed(sentences):
                if '?' in s:
                    generated_q = s.strip() + '?'
                    break
            if not generated_q:
                generated_q = "What's been going on?"
                
        return full_response, generated_q

    except Exception as e:
        print(f"Ollama Error: {e}")
        return ("Hmm... my brain is a little fuzzy right now.", 
                selected_question if selected_question else "Can we try that again?")
