ALTER TABLE "computer_profiles" ADD COLUMN "cpuCount" INTEGER;
ALTER TABLE "computer_profiles" ADD COLUMN "memoryMB" INTEGER;

ALTER TABLE "computers" ADD COLUMN "cpuCount" INTEGER;
ALTER TABLE "computers" ADD COLUMN "memoryMB" INTEGER;

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
    );
