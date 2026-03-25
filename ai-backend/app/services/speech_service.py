from faster_whisper import WhisperModel

# Load the model directly at module level
# Using "base" and cpu to keep it lightweight and fast
model_size = "base"
model = WhisperModel(model_size, device="cpu", compute_type="int8")

def transcribe_audio(file_path: str, preferred_language: str = "auto") -> tuple[str, list, str]:
    """
    Transcribes audio file to text using faster-whisper.
    """
    kwargs = {"beam_size": 5}
    if preferred_language and preferred_language != "auto":
        kwargs["language"] = preferred_language
        
    segments_gen, info = model.transcribe(file_path, **kwargs)
    segments = list(segments_gen)
    text = " ".join([segment.text.strip() for segment in segments])
    return text.strip(), segments, info.language
