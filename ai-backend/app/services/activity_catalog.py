from typing import Literal, get_args

GameCode = Literal["g1", "g2", "g3", "g4", "gl1", "gl2", "gl3", "gl4", "gl5"]
ExerciseCode = Literal["e1", "e2", "e3", "e4", "e5", "el1", "el2", "el3", "el4", "el5"]
GAME_CODES = get_args(GameCode)
EXERCISE_CODES = get_args(ExerciseCode)

def exercise_points(code, duration_ms):
    if code not in EXERCISE_CODES:
        raise ValueError("Unknown exercise")
    return 15 if code == "e4" and duration_ms >= 25 * 60000 else 5
