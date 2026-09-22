CREATE TABLE "computer_profiles" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "template" TEXT,
    "cpuCount" INTEGER,
    "memoryMB" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "computer_profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "computers" ADD COLUMN "profileId" TEXT;
ALTER TABLE "computers" ADD COLUMN "template" TEXT;
ALTER TABLE "computers" ADD COLUMN "cpuCount" INTEGER;
ALTER TABLE "computers" ADD COLUMN "memoryMB" INTEGER;

CREATE UNIQUE INDEX "computer_profiles_spaceId_name_key"
    ON "computer_profiles"("spaceId", "name");
CREATE INDEX "computer_profiles_spaceId_createdAt_idx"
    ON "computer_profiles"("spaceId", "createdAt");
CREATE INDEX "computers_profileId_idx" ON "computers"("profileId");

ALTER TABLE "computer_profiles"
    ADD CONSTRAINT "computer_profiles_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "computers"
    ADD CONSTRAINT "computers_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "computer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "computer_profiles"
    ADD CONSTRAINT "computer_profiles_cpuCount_check"
    CHECK ("cpuCount" IS NULL OR "cpuCount" > 0),
    ADD CONSTRAINT "computer_profiles_memoryMB_check"
    CHECK (
        "memoryMB" IS NULL OR
        (
            "memoryMB" > 0 AND
            ("kind" <> 'e2b' OR MOD("memoryMB", 2) = 0) AND
            ("kind" <> 'docker' OR "memoryMB" >= 6)
        )
    ),
    ADD CONSTRAINT "computer_profiles_e2b_resources_pair_check"
    CHECK (
        "kind" <> 'e2b' OR
        (("cpuCount" IS NULL AND "memoryMB" IS NULL) OR
         ("cpuCount" IS NOT NULL AND "memoryMB" IS NOT NULL))
    );

ALTER TABLE "computers"
    ADD CONSTRAINT "computers_cpuCount_check"
    CHECK ("cpuCount" IS NULL OR "cpuCount" > 0),
    ADD CONSTRAINT "computers_memoryMB_check"
    CHECK (
        "memoryMB" IS NULL OR
        (
            "memoryMB" > 0 AND
            ("kind" <> 'e2b' OR MOD("memoryMB", 2) = 0) AND
            ("kind" <> 'docker' OR "memoryMB" >= 6)
        )
    ),
    ADD CONSTRAINT "computers_e2b_resources_pair_check"
    CHECK (
        "kind" <> 'e2b' OR
        (("cpuCount" IS NULL AND "memoryMB" IS NULL) OR
         ("cpuCount" IS NOT NULL AND "memoryMB" IS NOT NULL))
    );
