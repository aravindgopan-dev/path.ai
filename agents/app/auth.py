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
    # Create an httpx-like request object for the Clerk SDK
    # The SDK's authenticate_request expects something it can read headers from
    try:
        # Note: clerk-backend-api SDK's authenticate_request expects a Request-like object.
        # It internally looks for "Authorization" header.
        
        # In a real FastAPI setup, we might need a wrapper if the SDK is strict about httpx.Request
        # but usually it just needs an object with .headers.
        
        # We need to specify authorized_parties if we want to restrict which clients can call us.
        # For now, we'll allow relevant origins or leave it flexible if not strictly required.
        options = AuthenticateRequestOptions()
        
        request_state = clerk_client.authenticate_request(request, options)
        
        if not request_state.is_signed_in:
            raise HTTPException(
                status_code=401, 
                detail=f"Invalid or missing authentication: {request_state.reason or 'Unknown'}"
            )
        
        # The payload contains 'sub' which is the Clerk User ID
        return request_state.payload.get("sub")
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
