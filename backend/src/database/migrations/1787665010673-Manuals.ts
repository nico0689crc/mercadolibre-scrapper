import { MigrationInterface, QueryRunner } from 'typeorm';

export class Manuals1787665010673 implements MigrationInterface {
  name = 'Manuals1787665010673';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD "crawl_strategy" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD "crawl_config" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD "crawled_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD "manuals_found" integer NOT NULL DEFAULT '0'`,
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
    await queryRunner.query(
      `ALTER TABLE "manufacturers" DROP COLUMN "manuals_found"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" DROP COLUMN "crawled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" DROP COLUMN "crawl_config"`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" DROP COLUMN "crawl_strategy"`,
    );
  }
}
