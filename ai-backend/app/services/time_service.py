from datetime import datetime
import random
from typing import Tuple

def get_time_context() -> Tuple[str, str, bool]:
    """
    Evaluates current time to structure contextual prompts.
    Returns: (current_time_str, time_of_day_category, should_ask_time_question)
    """
    now = datetime.now()
    hour = now.hour
    
    current_time_str = now.strftime("%H:%M")
    
    if 5 <= hour < 12:
        time_of_day = "morning"
    elif 12 <= hour < 17:
        time_of_day = "afternoon"
    elif 17 <= hour < 22:
        time_of_day = "evening"
    else:
        time_of_day = "night"
        
    # ~30% probability to naturally ask about meals/sleep based on time
    # This keeps Vani from obnoxiously asking "did you sleep?" on every single interaction.
    should_ask_time_question = random.random() < 0.3
    
    return current_time_str, time_of_day, should_ask_time_question
