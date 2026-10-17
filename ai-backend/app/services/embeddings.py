import math
import httpx
from app.settings import get_settings

def normalized_vector(values):
    if len(values) != 768 or not all(math.isfinite(v) for v in values):
        raise ValueError("Embedding must contain 768 finite values")
    norm = math.sqrt(sum(v * v for v in values))
    if norm == 0:
        raise ValueError("Zero embedding")
    return [v / norm for v in values]

async def embed(text, query=False):
    s = get_settings()
    if not s.embedding_api_key:
        raise RuntimeError("Embedding provider is not configured")
    if s.embedding_provider == "google":
        from google import genai
        from google.genai import types
        async with genai.Client(api_key=s.embedding_api_key).aio as client:
            result = await client.models.embed_content(model=s.embedding_model, contents=text,
                config=types.EmbedContentConfig(output_dimensionality=768, task_type="RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT"))
        return normalized_vector(result.embeddings[0].values)
    if not s.embedding_base_url.startswith("https://"):
        raise ValueError("Embedding endpoint requires HTTPS")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(s.embedding_base_url.rstrip("/") + "/embeddings", headers={"Authorization": f"Bearer {s.embedding_api_key}"},
                                     json={"model": s.embedding_model, "input": text, "dimensions": 768})
        response.raise_for_status()
        return normalized_vector(response.json()["data"][0]["embedding"])
