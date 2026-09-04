from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from ..database.prisma import client
from ..services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


# ── Pydantic Request/Response Models ──────────────────────────────────────────

class SignupRequest(BaseModel):
    business_name: str
    owner_name: str
    email: EmailStr
    password: str


class SigninRequest(BaseModel):
    email: EmailStr
    password: str


class BusinessUser(BaseModel):
    id: int
    business_name: str
    owner_name: str
    email: str
    created_at: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: BusinessUser


# ── Dependency: Get Current Authenticated Business ───────────────────────────

async def get_current_business(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    business_id = int(payload["sub"])
    if not client.is_connected():
        await client.connect()

    business = await client.business.find_unique(where={"id": business_id})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Business account not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return business


# Optional auth dependency (does not throw if token not provided, but validates if provided)
async def get_optional_business(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    if not credentials:
        return None
    try:
        return await get_current_business(credentials)
    except HTTPException:
        return None


# ── Auth Endpoints ───────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(req: SignupRequest):
    if not client.is_connected():
        await client.connect()

    # Check if business with email already exists
    existing = await client.business.find_unique(where={"email": req.email.lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Hash the password
    pw_hash = hash_password(req.password)

    # Create business record in PostgreSQL
    new_business = await client.business.create(
        data={
            "business_name": req.business_name.strip(),
            "owner_name": req.owner_name.strip(),
            "email": req.email.lower().strip(),
            "password_hash": pw_hash,
        }
    )

    # Issue JWT token
    token = create_access_token({
        "sub": str(new_business.id),
        "email": new_business.email,
        "business_name": new_business.business_name,
    })

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=BusinessUser(
            id=new_business.id,
            business_name=new_business.business_name,
            owner_name=new_business.owner_name,
            email=new_business.email,
            created_at=new_business.created_at.isoformat() if new_business.created_at else None,
        ),
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(req: SigninRequest):
    if not client.is_connected():
        await client.connect()

    business = await client.business.find_unique(where={"email": req.email.lower()})
    if not business:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(req.password, business.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({
        "sub": str(business.id),
        "email": business.email,
        "business_name": business.business_name,
    })

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=BusinessUser(
            id=business.id,
            business_name=business.business_name,
            owner_name=business.owner_name,
            email=business.email,
            created_at=business.created_at.isoformat() if business.created_at else None,
        ),
    )


@router.get("/me", response_model=BusinessUser)
async def get_me(current_business=Depends(get_current_business)):
    return BusinessUser(
        id=current_business.id,
        business_name=current_business.business_name,
        owner_name=current_business.owner_name,
        email=current_business.email,
        created_at=current_business.created_at.isoformat() if current_business.created_at else None,
    )


@router.post("/logout")
async def logout():
    return {"status": "success", "message": "Logged out successfully"}
