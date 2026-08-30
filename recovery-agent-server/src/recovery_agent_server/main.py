from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from .api.company import router as company_router
from .api.company import client as company_client
from .api.invoices import router as invoices_router
from .api.invoices import client as invoices_client
from .database.prisma import client as db_client
from .agent.due_invoices import check_overdue_invoices

app = FastAPI()
scheduler = AsyncIOScheduler()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    if not company_client.is_connected():
        await company_client.connect()
    if not invoices_client.is_connected():
        await invoices_client.connect()
    if not db_client.is_connected():
        await db_client.connect()
        
    scheduler.add_job(check_overdue_invoices, 'interval', hours=1)
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    if company_client.is_connected():
        await company_client.disconnect()
    if invoices_client.is_connected():
        await invoices_client.disconnect()
    if db_client.is_connected():
        await db_client.disconnect()
    scheduler.shutdown()

app.include_router(company_router)
app.include_router(invoices_router)


@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/test-workflow")
async def test_workflow():
    """Manual trigger to test the scheduled workflow."""
    results = await check_overdue_invoices()
    return {"status": "success", "results": results}
