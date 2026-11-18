-- Additive migration: old observations and old application versions remain valid.
ALTER TABLE "access_observation"
  ADD COLUMN "representation" VARCHAR(16),
  ADD COLUMN "http_method" VARCHAR(8),
  ADD COLUMN "status_code" INTEGER,
  ADD COLUMN "content_version" VARCHAR(64),
  ADD COLUMN "collector_version" VARCHAR(32),
  ADD COLUMN "collection_policy_version" VARCHAR(64),
  ADD COLUMN "synthetic" BOOLEAN,
  ADD COLUMN "verification_run_id" UUID,
  ADD COLUMN "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "access_observation_website_id_verification_run_id_idx"
  ON "access_observation"("website_id", "verification_run_id");
