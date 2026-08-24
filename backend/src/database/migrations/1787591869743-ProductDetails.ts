import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductDetails1787591869743 implements MigrationInterface {
  name = 'ProductDetails1787591869743';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "thumbnail" text`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "short_description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "attributes" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "pictures" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "tags" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "quality_type" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "parent_id" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "children_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "ml_date_created" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "ml_last_updated" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "products" ADD "permalink" text`);
    await queryRunner.query(
      `ALTER TABLE "products" ADD "main_features" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "listings_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "sellers_count" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "price_min" numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "price_max" numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "currency_id" character varying(8)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD "detail_fetched_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'::jsonb`,
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
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "detail_fetched_at"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "currency_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "price_max"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "price_min"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "sellers_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "listings_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "main_features"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "permalink"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "ml_last_updated"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "ml_date_created"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "children_count"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "parent_id"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "quality_type"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "tags"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "pictures"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "attributes"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "short_description"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "thumbnail"`);
  }
}
