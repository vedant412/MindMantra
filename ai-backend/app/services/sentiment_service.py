from transformers import pipeline

# Initialize the pipeline once at module load
# We use the default distilbert-base-uncased-finetuned-sst-2-english
import logging
logging.getLogger("transformers").setLevel(logging.ERROR)

try:
    sentiment_analyzer = pipeline("sentiment-analysis")
except Exception as e:
    print(f"Warning: Could not load sentiment analyzer pipeline. {e}")
    sentiment_analyzer = None

def analyze_sentiment(text: str) -> str:
    """Uses HuggingFace pipeline to return positive, negative, or neutral."""
    if not sentiment_analyzer:
        return "neutral"
        
    try:
        # returns [{'label': 'POSITIVE', 'score': 0.99...}]
        result = sentiment_analyzer(text)[0]
        label = result['label'].lower()
        score = result['score']
        
        # Determine if strong enough to be pos/neg, else neutral
        if label == "positive" and score > 0.6:
            return "positive"
        elif label == "negative" and score > 0.6:
            return "negative"
        else:
            return "neutral"
    except Exception:
        return "neutral"
