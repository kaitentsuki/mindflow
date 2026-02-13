-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "ThoughtType" AS ENUM ('task', 'idea', 'note', 'reminder', 'journal');

-- CreateEnum
CREATE TYPE "ThoughtStatus" AS ENUM ('active', 'done', 'snoozed', 'archived');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thoughts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "raw_transcript" TEXT NOT NULL,
    "cleaned_text" TEXT NOT NULL,
    "summary" TEXT,
    "type" "ThoughtType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentiment" DOUBLE PRECISION,
    "entities" JSONB NOT NULL DEFAULT '{}',
    "action_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deadline" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "snoozed_until" TIMESTAMPTZ,
    "status" "ThoughtStatus" NOT NULL DEFAULT 'active',
    "embedding" vector(1536),
    "audio_url" TEXT,
    "audio_duration_seconds" DOUBLE PRECISION,
    "language" VARCHAR(5) NOT NULL DEFAULT 'cs',
    "source" VARCHAR(20) NOT NULL DEFAULT 'voice',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thoughts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thought_connections" (
    "id" UUID NOT NULL,
    "thought_a_id" UUID NOT NULL,
    "thought_b_id" UUID NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "connection_type" VARCHAR(20) NOT NULL DEFAULT 'semantic',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thought_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "thought_id" UUID,
    "type" VARCHAR(20) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "dismissed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "thoughts_user_id_status_idx" ON "thoughts"("user_id", "status");

-- CreateIndex
CREATE INDEX "thoughts_user_id_type_idx" ON "thoughts"("user_id", "type");

-- CreateIndex
CREATE INDEX "thoughts_deadline_idx" ON "thoughts"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "thought_connections_thought_a_id_thought_b_id_key" ON "thought_connections"("thought_a_id", "thought_b_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_scheduled_for_idx" ON "notifications"("user_id", "scheduled_for");

-- AddForeignKey
ALTER TABLE "thoughts" ADD CONSTRAINT "thoughts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thought_connections" ADD CONSTRAINT "thought_connections_thought_a_id_fkey" FOREIGN KEY ("thought_a_id") REFERENCES "thoughts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thought_connections" ADD CONSTRAINT "thought_connections_thought_b_id_fkey" FOREIGN KEY ("thought_b_id") REFERENCES "thoughts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_thought_id_fkey" FOREIGN KEY ("thought_id") REFERENCES "thoughts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
