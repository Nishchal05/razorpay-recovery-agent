-- CreateEnum
CREATE TYPE "PreferredChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'VOICE_CALL');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "preferred_channel" "PreferredChannel" NOT NULL DEFAULT 'WHATSAPP';
