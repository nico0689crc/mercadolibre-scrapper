import { MigrationInterface, QueryRunner } from 'typeorm';

export class SearchQuota1787662989021 implements MigrationInterface {
  name = 'SearchQuota1787662989021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "search_quota" ("provider" character varying(32) NOT NULL, "period" character varying(7) NOT NULL, "used" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_77ccdb71e642ad05a81213e313f" PRIMARY KEY ("provider", "period"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ALTER COLUMN "official_domains" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "attributes" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "pictures" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tags" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "main_features" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ALTER COLUMN "keywords" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "main_features" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "tags" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "pictures" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "attributes" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ALTER COLUMN "official_domains" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(`DROP TABLE "search_quota"`);
  }
}
