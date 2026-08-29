-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'DISPUTE', 'PAID');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('RECEIVED', 'SENT');

-- CreateTable
CREATE TABLE "Company" (
    "company_id" SERIAL NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_address" TEXT NOT NULL,
    "company_phone" TEXT NOT NULL,
    "company_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "CompanyHistory" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "history" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "invoice_id" SERIAL NOT NULL,
    "invoice_name" TEXT NOT NULL,
    "invoice_due_date" TIMESTAMP(3) NOT NULL,
    "invoice_amount" DECIMAL(12,2) NOT NULL,
    "invoice_amount_status" BOOLEAN NOT NULL DEFAULT false,
    "invoice_status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "company_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("invoice_id")
);

-- CreateTable
CREATE TABLE "Message" (
    "message_id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_company_name_key" ON "Company"("company_name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_company_phone_key" ON "Company"("company_phone");

-- CreateIndex
CREATE UNIQUE INDEX "Company_company_email_key" ON "Company"("company_email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHistory_company_id_key" ON "CompanyHistory"("company_id");

-- CreateIndex
CREATE INDEX "Invoice_company_id_idx" ON "Invoice"("company_id");

-- CreateIndex
CREATE INDEX "Invoice_invoice_due_date_idx" ON "Invoice"("invoice_due_date");

-- CreateIndex
CREATE INDEX "Invoice_invoice_status_idx" ON "Invoice"("invoice_status");

-- CreateIndex
CREATE INDEX "Message_invoice_id_idx" ON "Message"("invoice_id");

-- AddForeignKey
ALTER TABLE "CompanyHistory" ADD CONSTRAINT "CompanyHistory_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "Invoice"("invoice_id") ON DELETE CASCADE ON UPDATE CASCADE;
