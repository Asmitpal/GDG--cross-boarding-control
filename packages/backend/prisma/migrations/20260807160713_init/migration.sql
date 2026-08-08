-- CreateEnum
CREATE TYPE "HireLevel" AS ENUM ('IC', 'MANAGER', 'EXEC');

-- CreateEnum
CREATE TYPE "HireStatus" AS ENUM ('AWAITING_APPROVAL', 'PROVISIONING', 'BLOCKED', 'CLEARED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskOwner" AS ENUM ('HR', 'IT', 'MANAGER');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('STANDARD', 'ELEVATED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'REJECTED', 'BLOCKED', 'DONE');

-- CreateTable
CREATE TABLE "hires" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" "HireLevel" NOT NULL DEFAULT 'IC',
    "startDate" DATE NOT NULL,
    "managerName" TEXT NOT NULL,
    "managerHandle" TEXT,
    "status" "HireStatus" NOT NULL DEFAULT 'AWAITING_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "hireId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "hardwareBudget" INTEGER NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_graphs" (
    "id" TEXT NOT NULL,
    "hireId" TEXT NOT NULL,
    "owner" "TaskOwner" NOT NULL,
    "label" TEXT NOT NULL,
    "system" TEXT,
    "accessLevel" "AccessLevel",
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "slaHours" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isEscalated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_escalations" (
    "id" TEXT NOT NULL,
    "hireId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "owner" "TaskOwner" NOT NULL,
    "overdueHours" INTEGER NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_configs" (
    "id" TEXT NOT NULL,
    "departments" JSONB NOT NULL,
    "deviceTiers" JSONB NOT NULL,
    "sla" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_hireId_key" ON "approval_requests"("hireId");

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "hires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_graphs" ADD CONSTRAINT "task_graphs_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "hires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_hireId_fkey" FOREIGN KEY ("hireId") REFERENCES "hires"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalations" ADD CONSTRAINT "sla_escalations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
