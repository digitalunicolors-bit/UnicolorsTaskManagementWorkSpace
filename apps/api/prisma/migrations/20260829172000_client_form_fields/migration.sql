ALTER TABLE "clients"
ADD COLUMN "clientServicingId" TEXT,
ADD COLUMN "deliverables" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "primaryContacts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "clients_clientServicingId_idx"
ON "clients"("clientServicingId");

ALTER TABLE "clients"
ADD CONSTRAINT "clients_clientServicingId_fkey"
FOREIGN KEY ("clientServicingId")
REFERENCES "employee_profiles"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
