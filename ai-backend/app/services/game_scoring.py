"""Game arithmetic is deterministic backend code, never an LLM operation."""
def calculate_game_score(game_code, rounds):
    from app.services.activity_catalog import GAME_CODES
    if game_code not in GAME_CODES:
        raise ValueError("Unknown game")
    if game_code == "gl2":
        if not rounds or len(rounds) > 20:
            raise ValueError("Card Match allows up to 20 attempts")
        matches = sum(bool(result.correct) for result in rounds)
        if matches > 5 or (matches < 5 and len(rounds) != 20):
            raise ValueError("Finish all five pairs or twenty attempts")
        # Accuracy, rounded half up to a multiple of five. No LLM arithmetic.
        return ((20 * matches + len(rounds)) // (2 * len(rounds))) * 5
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
