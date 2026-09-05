from fastapi import APIRouter, Request, HTTPException, Depends, status
from datetime import timedelta
import datetime
from ..database.prisma import client
from .auth import get_optional_business, get_current_business
from ..services.razorpay_service import generate_payment_link
from ..services.notification_service import send_invoice_created_notifications

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

        # Retrieve company details (and verify ownership if business is authenticated)
        where_company = {"company_id": company_id}
        if current_business:
            where_company["business_id"] = current_business.id

        company = await client.company.find_first(where=where_company)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found in your account",
            )

        # 1. Generate Razorpay Payment Link for this invoice
        payment_link = ""
        payment_link_id = ""
        try:
            rzp_result = await generate_payment_link(
                amount=invoice_amount,
                description=f"Payment for invoice {invoice_name}",
                customer_name=company.company_name,
                customer_email=company.company_email,
                customer_phone=company.company_phone,
                invoice_name=invoice_name,
            )
            payment_link = rzp_result.get("short_url", "")
            payment_link_id = rzp_result.get("payment_link_id", "")
            print(f"[invoices] Created Razorpay link: {payment_link}")
        except Exception as rzp_err:
            print(f"[invoices] Failed to generate Razorpay link: {rzp_err}")

        # 2. Save Invoice with payment_link into PostgreSQL backend
        response = await client.invoice.create(
            data={
                "company_id": company_id,
                "invoice_name": invoice_name,
                "invoice_due_date": invoice_due_date,
                "invoice_amount": invoice_amount,
                "invoice_amount_status": invoice_amount_status,
                "invoice_status": invoice_status,
                "payment_link": payment_link,
                "payment_link_id": payment_link_id,
            },
            include={"company": True}
        )

        # 3. Dispatch WhatsApp and Gmail notifications to customer
        business_name = current_business.business_name if current_business else None
        notification_results = await send_invoice_created_notifications(
            customer_name=company.company_name,
            customer_email=company.company_email,
            customer_phone=company.company_phone,
            invoice_name=invoice_name,
            invoice_amount=invoice_amount,
            invoice_due_date=invoice_due_date,
            payment_link=payment_link,
            business_name=business_name,
        )

        # Attach notifications summary to response dict
        res_dict = response.dict() if hasattr(response, "dict") else dict(response)
        res_dict["notifications"] = notification_results
        return res_dict

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


@router.patch("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: int,
    request: Request,
    current_business=Depends(get_optional_business),
):
    if not client.is_connected():
        await client.connect()

    try:
        data = await request.json()
        where = {"invoice_id": invoice_id}
        if current_business:
            where["company"] = {"business_id": current_business.id}

        existing = await client.invoice.find_first(where=where)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found",
            )

        update_data = {}
        if "invoice_amount_status" in data:
            update_data["invoice_amount_status"] = bool(data["invoice_amount_status"])
            if data["invoice_amount_status"]:
                update_data["invoice_status"] = "PAID"
                update_data["recovery_status"] = "RESOLVED"

        if "invoice_status" in data:
            update_data["invoice_status"] = data["invoice_status"]

        if "recovery_status" in data:
            update_data["recovery_status"] = data["recovery_status"]

        updated = await client.invoice.update(
            where={"invoice_id": invoice_id},
            data=update_data,
            include={"company": True},
        )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update invoice: {str(e)}",
        )