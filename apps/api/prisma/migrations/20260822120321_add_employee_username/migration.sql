/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `employee_profiles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_username_key" ON "employee_profiles"("username");
