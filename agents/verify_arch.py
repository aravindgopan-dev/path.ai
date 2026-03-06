import sys
import os

# Add parent directory to path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.agents.validator_agent import validate_code

def test_validator_with_reasons():
    user_files = [{"filename": "auth.ts", "content": "import { Request } from 'express';\nfunction login() { console.log('hello'); }"}]
    expected_spec = {
        "validation_rules": [
            {"contains": "login", "reason": "We need an entry point for auth."},
            {"contains": "bcrypt", "reason": "Security is important!"}
        ],
        "expected_files": ["auth.ts"]
    }
    
    result = validate_code(user_files, expected_spec)
    print(f"Status: {result['status']}")
    print(f"Notes: {result['notes']}")
    print(f"Score: {result['score']}")
    
    assert "login" in str(result['notes']) or result['score'] > 0
    assert any("Security is important!" in n for n in result['notes'])

if __name__ == "__main__":
    test_validator_with_reasons()
    print("Validator test PASSED!")
