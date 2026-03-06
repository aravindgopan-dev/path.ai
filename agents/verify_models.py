import os
import sys

# Add the agents directory to sys.path to allow imports
sys.path.append(os.path.join(os.getcwd()))

try:
    from app.utils.model_factory import get_small_llm, get_medium_llm, get_large_llm
    from langchain_openai import ChatOpenAI

    print("--- Verifying Model Factory Configuration ---")
    
    small = get_small_llm()
    print(f"Small LLM: {small.model_name if hasattr(small, 'model_name') else 'unknown'} (Expected: gpt-4o-mini)")
    
    medium = get_medium_llm()
    print(f"Medium LLM: {medium.model_name if hasattr(medium, 'model_name') else 'unknown'} (Expected: gpt-4o)")
    
    large = get_large_llm()
    print(f"Large LLM: {large.model_name if hasattr(large, 'model_name') else 'unknown'} (Expected: gpt-4o)")

    if isinstance(small, ChatOpenAI) and small.model_name == "gpt-4o-mini":
        print("\n✅ Verification SUCCESSful: Small LLM is correctly configured.")
    else:
        print("\n❌ Verification FAILED: Small LLM is not gpt-4o-mini or not ChatOpenAI.")

except Exception as e:
    print(f"\n❌ Verification FAILED with error: {e}")
