import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787586323491 implements MigrationInterface {
  name = 'InitialSchema1787586323491';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() lo aporta uuid-ossp; en Postgres 18 no viene activada por defecto.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "categories" ("id" character varying(32) NOT NULL, "site_id" character varying(8) NOT NULL, "name" character varying(255) NOT NULL, "parent_id" character varying(32), "total_items" integer NOT NULL DEFAULT '0', "catalog_domain" character varying(128), "is_leaf" boolean NOT NULL DEFAULT false, "depth" integer NOT NULL DEFAULT '0', "path" jsonb NOT NULL DEFAULT '[]'::jsonb, "synced_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_411cbb14d7ab96d475a721c1cf" ON "categories"  ("site_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_88cea2dc9c31951d06437879b4" ON "categories"  ("parent_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7bef0a3ad9d7d26f0405da0dc1" ON "categories"  ("depth") `,
    );
    await queryRunner.query(
      `CREATE TABLE "category_brands" ("category_id" character varying(32) NOT NULL, "brand_id" uuid NOT NULL, "products" integer NOT NULL DEFAULT '0', "products_max" integer NOT NULL DEFAULT '0', "occurrences" integer NOT NULL DEFAULT '0', "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b12319bad97cae378c4f521387" PRIMARY KEY ("category_id", "brand_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f80f32e867fbc4ba035785707e" ON "category_brands"  ("category_id", "products") `,
    );
    await queryRunner.query(
      `CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ml_value_id" character varying(32), "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_186159806328c7e64047530ae4" ON "brands"  ("ml_value_id") WHERE ml_value_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b15428f362be2200922952dc26" ON "brands"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scan_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "category_id" character varying(32) NOT NULL, "strategy" character varying(32) NOT NULL, "seeds" integer NOT NULL DEFAULT '0', "pages" integer NOT NULL DEFAULT '0', "keywords" jsonb NOT NULL DEFAULT '[]'::jsonb, "domain_filtered" boolean NOT NULL DEFAULT false, "sampled" integer NOT NULL DEFAULT '0', "brands_found" integer NOT NULL DEFAULT '0', "brands_new" integer NOT NULL DEFAULT '0', "duration_ms" integer NOT NULL DEFAULT '0', "status" character varying(16) NOT NULL DEFAULT 'running', "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dfa54d6ed31827275b98e560942" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6acdb2c321f4dbfddecfe15c0b" ON "scan_runs"  ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8bc0c6723325bbf329d9970f3a" ON "scan_runs"  ("status") `,
    );
    await queryRunner.query(
      `ALTER TABLE "category_brands" ADD CONSTRAINT "FK_0f2577d3e847475ecf0f9aefdb4" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_brands" ADD CONSTRAINT "FK_dcb5e8a55a4180e383aafdb1937" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_brands" DROP CONSTRAINT "FK_dcb5e8a55a4180e383aafdb1937"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_brands" DROP CONSTRAINT "FK_0f2577d3e847475ecf0f9aefdb4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8bc0c6723325bbf329d9970f3a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6acdb2c321f4dbfddecfe15c0b"`,
    );
    await queryRunner.query(`DROP TABLE "scan_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b15428f362be2200922952dc26"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_186159806328c7e64047530ae4"`,
    );
    await queryRunner.query(`DROP TABLE "brands"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f80f32e867fbc4ba035785707e"`,
    );
    await queryRunner.query(`DROP TABLE "category_brands"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7bef0a3ad9d7d26f0405da0dc1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_88cea2dc9c31951d06437879b4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_411cbb14d7ab96d475a721c1cf"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
