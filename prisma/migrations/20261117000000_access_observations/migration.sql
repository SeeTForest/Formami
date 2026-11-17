CREATE TABLE "access_observation" (
  "id" UUID NOT NULL,
  "website_id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "source" VARCHAR(16) NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "content_key" VARCHAR(64) NOT NULL,
  "signal" VARCHAR(32) NOT NULL,
  "provider" VARCHAR(16) NOT NULL,
  "outcome" VARCHAR(16) NOT NULL,
  "actor" VARCHAR(16) NOT NULL,
  "purpose" VARCHAR(32) NOT NULL,
  "evidence" VARCHAR(32) NOT NULL,
  "confidence" VARCHAR(16) NOT NULL,
  "rule_version" VARCHAR(32) NOT NULL,
  CONSTRAINT "access_observation_pkey" PRIMARY KEY ("website_id", "id"),
  CONSTRAINT "access_observation_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("website_id") ON DELETE CASCADE
);
CREATE INDEX "access_observation_website_id_occurred_at_idx" ON "access_observation"("website_id", "occurred_at");
