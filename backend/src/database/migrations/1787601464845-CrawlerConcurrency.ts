import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrawlerConcurrency1787601464845 implements MigrationInterface {
  name = 'CrawlerConcurrency1787601464845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "crawler_state" ADD "concurrency" integer NOT NULL DEFAULT '2'`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'::jsonb`,
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
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "crawler_state" DROP COLUMN "concurrency"`,
    );
  }
}
