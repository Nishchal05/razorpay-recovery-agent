from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from prisma import Prisma
from datetime import datetime


app = FastAPI()
client = Prisma()

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def daily_invoice_job():
    try:
        response = client.invoice.find_many({
            "where": {
                "invoice_due_date": {
                    "gte": datetime.date
                }
            }   
        })
        
    except Exception as e:
        print(e)


@app.on_event("startup")
async def startup():
    scheduler.add_job(
        daily_invoice_job,
        trigger="cron",
        hour=9,
        minute=0,
        id="daily_invoice_job",
        replace_existing=True,
    )

    scheduler.start()


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()