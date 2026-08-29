from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.company import router as company_router
from .api.company import client as company_client
from .api.invoices import router as invoices_router
from .api.invoices import client as invoices_client

app = FastAPI()

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

@app.on_event("shutdown")
async def shutdown():
    if company_client.is_connected():
        await company_client.disconnect()
    if invoices_client.is_connected():
        await invoices_client.disconnect()

app.include_router(company_router)
app.include_router(invoices_router)


@app.get("/")
def read_root():
    return {"Hello": "World"}


