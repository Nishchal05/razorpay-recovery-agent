from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List
from ..database.prisma import client
from .auth import get_current_business, get_optional_business

router = APIRouter(tags=["Company"])


class CreateCompanyRequest(BaseModel):
    company_name: str
    company_email: str
    company_phone: str
    company_address: str
    preferred_channel: Optional[str] = "WHATSAPP"


@router.post("/company", status_code=status.HTTP_201_CREATED)
async def add_company(
    req: CreateCompanyRequest,
    current_business=Depends(get_current_business),
):
    if not client.is_connected():
        await client.connect()

    try:
        # If company with same name already exists for this business, return it
        existing = await client.company.find_first(
            where={
                "company_name": req.company_name.strip(),
                "business_id": current_business.id,
            }
        )
        if existing:
            return existing

        channel = req.preferred_channel.upper() if req.preferred_channel else "WHATSAPP"
        if channel not in ["WHATSAPP", "EMAIL", "VOICE_CALL"]:
            channel = "WHATSAPP"

        data = {
            "company_name": req.company_name.strip(),
            "company_email": req.company_email.strip().lower(),
            "company_address": req.company_address.strip(),
            "company_phone": req.company_phone.strip(),
            "preferred_channel": channel,
            "business_id": current_business.id,
        }

        new_company = await client.company.create(data=data)
        return new_company

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create company: {str(e)}",
        )


@router.get("/company")
async def get_companies(current_business=Depends(get_optional_business)):
    if not client.is_connected():
        await client.connect()

    try:
        # If authenticated, isolate to companies belonging to the current business
        if current_business:
            where = {"business_id": current_business.id}
        else:
            return []

        companies = await client.company.find_many(
            where=where,
            order={"company_id": "desc"}
        )
        return companies
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch companies: {str(e)}",
        )


@router.get("/company/{company_id}")
async def get_company(company_id: int, current_business=Depends(get_optional_business)):
    if not client.is_connected():
        await client.connect()

    try:
        where = {"company_id": company_id}
        if current_business:
            where["business_id"] = current_business.id

        company = await client.company.find_first(where=where)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found",
            )
        return company
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch company: {str(e)}",
        )