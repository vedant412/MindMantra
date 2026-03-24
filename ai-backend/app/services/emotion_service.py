import base64
import io
import numpy as np

try:
    from fer import FER
    import cv2
    _detector = FER(mtcnn=True)
    _available = True
except ImportError:
    _detector = None
    _available = False
    print("WARNING: FER or OpenCV not installed. Emotion detection disabled.")

def detect_emotion_from_base64(image_b64: str) -> dict:
    """
    Accepts a base64-encoded image string (from mobile camera),
    decodes it, runs FER facial expression recognition,
    and returns the dominant emotion with confidence.
    """
    if not _available or _detector is None:
        return {"emotion": "neutral", "confidence": 0.0, "available": False}
    
    try:
        # Decode base64 → numpy array
        img_bytes = base64.b64decode(image_b64)
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"emotion": "neutral", "confidence": 0.0, "error": "Could not decode image"}
        
        # Run FER detection
        results = _detector.detect_emotions(img)
        
        if not results:
            return {"emotion": "neutral", "confidence": 0.0, "faces_found": 0}
        
        # Take first face
        face = results[0]
        emotions = face.get("emotions", {})
        
        # Find dominant emotion
        dominant = max(emotions, key=emotions.get)
        confidence = emotions[dominant]
        
        # Map FER emotions to our system
        emotion_map = {
            "angry": "stressed",
            "disgust": "stressed", 
            "fear": "stressed",
            "happy": "happy",
            "sad": "sad",
            "surprise": "surprise",
            "neutral": "neutral"
        }
        
        mapped_emotion = emotion_map.get(dominant, "neutral")
        
        return {
            "emotion": mapped_emotion,
            "confidence": round(confidence, 2),
            "raw_emotion": dominant,
            "all_emotions": {k: float(f"{float(v):.2f}") for k, v in emotions.items()},
            "faces_found": len(results)
        }
        
    except Exception as e:
        print(f"Emotion detection error: {e}")
        return {"emotion": "neutral", "confidence": 0.0, "error": str(e)}
