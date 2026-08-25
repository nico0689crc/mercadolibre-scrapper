import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualCrawlerState1787665997580 implements MigrationInterface {
  name = 'ManualCrawlerState1787665997580';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "manual_crawler_state" ("id" integer NOT NULL DEFAULT '1', "enabled" boolean NOT NULL DEFAULT false, "restale_days" integer NOT NULL DEFAULT '30', "verify" boolean NOT NULL DEFAULT true, "last_brand_id" uuid, "last_brand_name" character varying(255), "last_run_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "waiting_for_window" boolean NOT NULL DEFAULT false, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_964511328bb1509557acf4d2001" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ALTER COLUMN "official_domains" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ALTER COLUMN "crawl_config" SET DEFAULT '{}'::jsonb`,
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
      `ALTER TABLE "manufacturers" ALTER COLUMN "crawl_config" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ALTER COLUMN "official_domains" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(`DROP TABLE "manual_crawler_state"`);
  }
}
