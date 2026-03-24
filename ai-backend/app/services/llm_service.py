import requests
from typing import Dict, Optional

OLLAMA_URL = "http://localhost:11434/api/generate"

def generate_response(
    user_text: str, 
    memory: Dict, 
    state: str, 
    selected_question: str, 
    emotion: Optional[str] = None,
    cognitive_score: Optional[int] = None,
    cognitive_state: Optional[str] = None,
    sentiment: Optional[str] = None,
    confidence: Optional[float] = None,
    current_time: Optional[str] = None,
    time_of_day: Optional[str] = None,
    ask_time_q: bool = False,
    daily_summary: Optional[dict] = None,
    recent_insights: Optional[list[str]] = None
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
        
    length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be conversational."
    if emotion in ["stressed", "sad", "disgust", "fear"]:
        length_instruction = "Keep your response SHORT to MEDIUM (2-3 sentences max). Be highly supportive, empathetic, and gentle."
    elif emotion in ["happy", "surprise"]:
        length_instruction = "Keep your response extremely SHORT (1-2 sentences max). Be light and positive. Mirror their energy."

    prompt = f"""You are Vani, an empathetic AI companion. You are having a fluid, ongoing voice conversation with the user.

CORE PERSONALITY:
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

Respond naturally taking into account the history."""
    
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
            cut_idx_int = int(cut_index + 1)
            if cut_index > 10:
                full_response = truncated[:cut_idx_int]
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
