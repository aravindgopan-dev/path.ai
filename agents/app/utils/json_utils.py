import json
import re

def extract_json(text: str) -> dict | list:
    """Extracts and parses JSON from a string, handling markdown and comments."""
    if not text:
        return {}

    # 1. Strip markdown code blocks if present
    text = re.sub(r"```(?:json)?\s*(.*?)\s*```", r"\1", text, flags=re.DOTALL)

    # 2. Extract first valid { ... } or [ ... ]
    start_brace = text.find("{")
    start_bracket = text.find("[")
    
    start = -1
    end = -1
    
    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        start = start_brace
        end = text.rfind("}")
    elif start_bracket != -1:
        start = start_bracket
        end = text.rfind("]")
        
    if start != -1 and end != -1:
        text = text[start : end + 1]
    
    # 3. Strip single-line comments // ... and /* ... */ (basic)
    # Be careful not to strip // inside strings (e.g. http://)
    # A simple regex for // that aren't preceded by :
    text = re.sub(r"(?<!:)\/\/.*", "", text)
    
    try:
        return json.loads(text, strict=False)
    except json.JSONDecodeError:
        # Final attempt: try to fix common issues like trailing commas
        # This is a bit risky but can help. For now, let's just log and raise.
        raise ValueError(f"Failed to parse JSON even after cleanup. Content: {text[:200]}...")
