import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualsTable1787665348449 implements MigrationInterface {
  name = 'ManualsTable1787665348449';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "manuals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "brand_id" uuid NOT NULL, "model" character varying(64) NOT NULL, "model_raw" character varying(128) NOT NULL, "url" text NOT NULL, "source_domain" character varying(128) NOT NULL, "found_at_url" text, "content_type" character varying(64), "bytes" integer, "sha256" character varying(64), "verified" boolean NOT NULL DEFAULT false, "checked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_8f761ba45d8aded1b39c9191b2f" UNIQUE ("brand_id", "model"), CONSTRAINT "PK_ff041e52910af133b601ce3c707" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d0b672d1ce9383bba5e5c7d347" ON "manuals"  ("brand_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_278ff64d81044c3ddf753a517d" ON "manuals"  ("model") `,
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
    await queryRunner.query(
      `ALTER TABLE "manuals" ADD CONSTRAINT "FK_d0b672d1ce9383bba5e5c7d347d" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manuals" DROP CONSTRAINT "FK_d0b672d1ce9383bba5e5c7d347d"`,
    );
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
    await queryRunner.query(
      `DROP INDEX "public"."IDX_278ff64d81044c3ddf753a517d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d0b672d1ce9383bba5e5c7d347"`,
    );
    await queryRunner.query(`DROP TABLE "manuals"`);
  }
}
