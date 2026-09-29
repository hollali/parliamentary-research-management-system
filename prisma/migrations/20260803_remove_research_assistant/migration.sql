-- Remove RESEARCH_ASSISTANT and SUPER_ADMIN from the Role enum
--
-- The previous version of this migration only remapped RESEARCH_ASSISTANT and
-- then cast with `USING "role"::text::"Role"`. The init migration created the
-- enum WITH SUPER_ADMIN, and 20260713000000 explicitly punted its removal to
-- `prisma db push`. Any environment that was ever populated while SUPER_ADMIN
-- existed therefore aborted here:
--
--   ERROR: invalid input value for enum "Role": "SUPER_ADMIN"
--   ERROR: cannot drop type "Role_old" because other objects depend on it
--
-- leaving the database half-migrated with users.role pointing at an orphaned
-- Role_old type, and blocking every subsequent deploy until manual psql work.
--
-- The guards below make each step conditional so this file is safe both on a
-- fresh replay (old values present) and on a database where the enum has
-- already been recreated by `db push` (old values absent).

DO $$
BEGIN
  -- Remap both doomed values before touching the type. SUPER_ADMIN is folded
  -- into ADMIN because it was a strictly more privileged variant of it.
  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
             WHERE t.typname = 'Role' AND e.enumlabel = 'SUPER_ADMIN') THEN
    EXECUTE 'UPDATE "users" SET "role" = ''ADMIN'' WHERE "role" = ''SUPER_ADMIN''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
             WHERE t.typname = 'Role' AND e.enumlabel = 'RESEARCH_ASSISTANT') THEN
    EXECUTE 'UPDATE "users" SET "role" = ''RESEARCH_OFFICER'' WHERE "role" = ''RESEARCH_ASSISTANT''';
  END IF;
END$$;

-- Recreate the enum without either value, unless it is already correct.
DO $$
DECLARE
  has_old_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'Role' AND e.enumlabel IN ('SUPER_ADMIN', 'RESEARCH_ASSISTANT')
  ) INTO has_old_role;

  IF has_old_role THEN
    -- Drop the default first: it is typed against the old enum.
    EXECUTE 'ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT';
    EXECUTE 'ALTER TYPE "Role" RENAME TO "Role_old"';
    EXECUTE 'CREATE TYPE "Role" AS ENUM (''ADMIN'', ''RESEARCH_OFFICER'', ''MP'')';
    -- Both values were remapped above, so the cast cannot fail.
    EXECUTE 'ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::text::"Role"';
    EXECUTE 'DROP TYPE "Role_old"';
  END IF;
END$$;

-- Restore the column default against the new enum type if the earlier block
-- dropped it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE a.attrelid = 'users'::regclass AND a.attname = 'role'
  ) THEN
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'MP';
  END IF;
END$$;
