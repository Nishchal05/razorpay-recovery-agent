from fastapi import APIRouter, Request, HTTPException, Depends, status
from datetime import timedelta
import datetime
from ..database.prisma import client
from .auth import get_optional_business, get_current_business

router = APIRouter(tags=["Invoices"])


@router.post("/invoices", status_code=status.HTTP_201_CREATED)
async def add_invoices(
    request: Request,
    current_business=Depends(get_optional_business),
):
    if not client.is_connected():
        await client.connect()

    try:
        data = await request.json()
        company_id = int(data['company_id'])
        invoice_name = data['invoice_name']
        invoice_due_date = datetime.datetime.fromisoformat(data['invoice_due_date'].replace('Z', '+00:00'))
        invoice_amount = float(data['invoice_amount'])
        invoice_amount_status = bool(data.get('invoice_amount_status', False))
        invoice_status = data.get('invoice_status', 'PENDING')

        # If authenticated, ensure the company belongs to this business
        if current_business:
            company = await client.company.find_first(
                where={
                    "company_id": company_id,
                    "business_id": current_business.id,
                }
            )
            if not company:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Company not found in your account",
                )

        if invoice_due_date:
            invoice_due_date = invoice_due_date + timedelta(days=2)

        response = await client.invoice.create(
            data={
                "company_id": company_id,
                "invoice_name": invoice_name,
                "invoice_due_date": invoice_due_date,
                "invoice_amount": invoice_amount,
                "invoice_amount_status": invoice_amount_status,
                "invoice_status": invoice_status,
            },
            include={"company": True}
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice: {str(e)}",
        )


@router.get("/invoices")
async def get_invoices(current_business=Depends(get_optional_business)):
    if not client.is_connected():
        await client.connect()

    try:
        # Isolate invoices to only companies belonging to current business
        if current_business:
            where = {"company": {"business_id": current_business.id}}
        else:
            return []

        response = await client.invoice.find_many(
            where=where,
            include={"company": True},
            order={"invoice_id": "desc"},
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoices: {str(e)}",
        )


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: int, current_business=Depends(get_optional_business)):
    if not client.is_connected():
        await client.connect()

    try:
        where = {"invoice_id": invoice_id}
        if current_business:
            where["company"] = {"business_id": current_business.id}

        invoice = await client.invoice.find_first(
            where=where,
            include={"company": True},
        )
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found",
            )
        return invoice
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoice: {str(e)}",
        )