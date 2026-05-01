from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Optional
import litellm
import json
import asyncio
from src.scrape_tool.configs.base import settings

router = APIRouter(tags=["chat"])

@router.post("/chat/stream")
async def chat_stream(request: Request):
    data = await request.json()
    messages = data.get("messages", [])
    
    # Inject system prompt if ANALYZE_PROMPT is set in .env
    if settings.ANALYZE_PROMPT and not any(m.get("role") == "system" for m in messages):
        messages.insert(0, {
            "role": "system",
            "content": settings.ANALYZE_PROMPT.replace("\\n", "\n") # Handle literal \n from .env
        })
    
    stream = data.get("stream", True)
    
    # Configure litellm if needed (copied from scrape.py)
    custom_llm_url = None
    if settings.LLM_HOST:
        protocol = "https" if getattr(settings, 'LLM_SECURE', False) else "http"
        custom_llm_url = f"{protocol}://{settings.LLM_HOST}"
        if settings.LLM_PORT:
            custom_llm_url += f":{settings.LLM_PORT}"
    
    # Model selection logic: Use settings model directly if possible
    model_name = settings.LLM_MODEL or "gpt-4o-mini"
    
    # Only prefix with openai/ if it's not a custom model name on a custom host
    # This ensures local servers like vLLM/Ollama get the raw model name they expect
    if not custom_llm_url and "/" not in model_name:
        model_name = f"openai/{model_name}"
    elif custom_llm_url:
        # LiteLLM wants the provider/ prefix for its internal routing, 
        # but we should ensure the base model name is clean.
        # For OpenAI compatible endpoints, 'openai/' works as a provider indicator
        if not model_name.startswith("openai/"):
            model_name = f"openai/{model_name}"
    
    # Log the FINAL payload sent to LiteLLM for debugging
    import logging
    logger = logging.getLogger("uvicorn.error")
    logger.info(f"--- LLM REQUEST PAYLOAD ---")
    logger.info(f"Model: {model_name}")
    logger.info(f"Base URL: {custom_llm_url}")
    logger.info(f"Messages: {json.dumps(messages, ensure_ascii=False)}")
    logger.info(f"---------------------------")

    async def event_generator():
        try:
            logger.info(f"Initiating LiteLLM completion for model: {model_name}")
            response = await litellm.acompletion(
                model=model_name,
                messages=messages,
                api_key=settings.LLM_API_KEY,
                base_url=custom_llm_url,
                stream=True
            )
            
            chunk_count = 0
            async for chunk in response:
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                reasoning = getattr(delta, "reasoning_content", None)
                
                if content or reasoning:
                    chunk_count += 1
                    payload = {}
                    if content: 
                        payload["content"] = content
                    if reasoning: 
                        payload["reasoning_content"] = reasoning
                    
                    # Periodic logging to avoid flooding but show progress
                    if chunk_count % 50 == 0:
                        logger.info(f"Streaming chunk {chunk_count}...")
                        
                    yield f"data: {json.dumps(payload)}\n\n"
                    
            logger.info(f"Stream complete. Total chunks sent: {chunk_count}")
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat stream error: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
