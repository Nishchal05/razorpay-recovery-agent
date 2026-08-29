from datetime import datetime

from ..database.prisma import client
from .recoveryagent import recovery_graph


async def check_overdue_invoices():

    today = datetime.now()

    invoices = await client.invoice.find_many(
        where={
            "invoice_due_date": {
                "lt": today
            },
            "invoice_status": "PENDING"
        }
    )
    print(invoices)
    results = []

    for invoice in invoices:
        
        try:
            invoice_dict = invoice.model_dump()
        except AttributeError:
            invoice_dict = invoice.dict()

        result = await recovery_graph.ainvoke({
            "invoice_id": invoice.invoice_id,
            "invoice": invoice_dict
        })

        results.append({
            "invoice_id": invoice.invoice_id,
            "agent_result": result
        })

    return results