-- ==========================================================
-- Combined migration: RAG models + comparator columns
-- Drop old wrong-shape Conversation table if present
-- ==========================================================

DROP TABLE IF EXISTS "Conversation" CASCADE;

CREATE TABLE "conversation" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_preference" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "preferred_language" TEXT NOT NULL DEFAULT 'English',
    "learning_style" TEXT NOT NULL DEFAULT 'Detailed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_preference_student_id_key" ON "user_preference"("student_id");

CREATE TABLE "document" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "filesize" INTEGER NOT NULL,
    "markdown" TEXT,
    "blocks_json" TEXT,
    "page_dimensions_json" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunk" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunk_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "document_chunk"
ADD CONSTRAINT "document_chunk_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;