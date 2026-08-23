from fastapi import APIRouter, Request
from prisma import Prisma
from datetime import timedelta
import datetime

router = APIRouter()
client = Prisma()

@router.post("/invoices")
async def add_invoices(request: Request):
    try:
        data = await request.json()
        company_id = int(data['company_id'])
        invoice_name = data['invoice_name']
        # parse date
        invoice_due_date = datetime.datetime.fromisoformat(data['invoice_due_date'].replace('Z', '+00:00'))
        invoice_amount = float(data['invoice_amount'])
        invoice_amount_status = bool(data.get('invoice_amount_status', False))
        invoice_status = data.get('invoice_status', 'PENDING')
        
        if invoice_due_date:
            invoice_due_date = invoice_due_date + timedelta(days=2)    
            
        response = await client.invoice.create(
            data={
                "company_id": company_id,
                "invoice_name": invoice_name,
                "invoice_due_date": invoice_due_date,
                "invoice_amount": invoice_amount,
                "invoice_amount_status": invoice_amount_status,
                "invoice_status": invoice_status
            }
        )
        return response
    except Exception as e:
        return {"error": str(e), "message": "invoices not added"}
    
@router.get("/invoices")
async def get_invoices():
    try:
        response = await client.invoice.find_many(include={"company": True})
        return response
    except Exception as e:
        return {"error": str(e), "message": "invoices not fetched"}
    