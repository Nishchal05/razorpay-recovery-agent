from fastapi import APIRouter, Request
from prisma import Prisma

router = APIRouter()
client = Prisma()

@router.post("/company")
async def add_company(request: Request):
    try:
        data = await request.json()
        companyname = data['company_name']
        companyemail = data['company_email']
        companyaddress = data['company_address']
        companyphone = data['company_phone']
        
        response = await client.company.create(
            data={
                "company_name": companyname,
                "company_email": companyemail,
                "company_address": companyaddress,
                "company_phone": companyphone
            }
        )
        return response
    except Exception as e:
        return {"error": str(e), "message": "company not added"}

@router.get("/company")
async def get_companies():
    try:
        response = await client.company.find_many()
        return response
    except Exception as e:
        return {"error": str(e), "message": "companies not found"}