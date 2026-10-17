"""Game arithmetic is deterministic backend code, never an LLM operation."""
def calculate_game_score(game_code, rounds):
    if not rounds or len(rounds) > (3 if game_code == "g2" else 5):
        raise ValueError("Invalid round count")
    total = 0
    for index, result in enumerate(rounds):
        if not result.correct:
            if index != len(rounds) - 1:
                raise ValueError("Failed round must end the session")
            continue
        if game_code == "g2":
            if result.reaction_time_ms is None:
                raise ValueError("Reaction time required")
            total += 15 if result.reaction_time_ms < 300 else 10 if result.reaction_time_ms < 500 else 5
        else:
            total += 15 if game_code == "g4" else 10
    return total
