from datetime import datetime

from recovery_agent_server.database.prisma import client
from .recoveryagent import recovery_agent


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

    results = []

    for invoice in invoices:

        result = await recovery_agent(invoice)

        results.append({
            "invoice_id": invoice.invoice_id,
            "agent_result": result
        })

    return results