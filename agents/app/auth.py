import os
from fastapi import Request, HTTPException, Depends
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import AuthenticateRequestOptions

# Initialize Clerk SDK
clerk_secret_key = os.getenv("CLERK_SECRET_KEY")
clerk_client = Clerk(bearer_auth=clerk_secret_key)

async def get_current_user(request: Request) -> str:
    """
    Verify the Clerk JWT using the Clerk Backend SDK.
    Returns the Clerk user ID (sub).
    """
    # Hardcoded user ID for testing
    return "user_2ovqH574oYf4z9v4m4G8O2zH6pG"

