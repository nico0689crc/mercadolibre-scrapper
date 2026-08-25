import { MigrationInterface, QueryRunner } from 'typeorm';

export class Manufacturers1787607039153 implements MigrationInterface {
  name = 'Manufacturers1787607039153';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "manufacturers" ("brand_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'candidate', "segment" character varying(32) NOT NULL, "official_domains" jsonb NOT NULL DEFAULT '[]'::jsonb, "evidence_url" text, "notes" text, "products" integer NOT NULL DEFAULT '0', "models" integer NOT NULL DEFAULT '0', "verified_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fce6b7d542fc728e866f7d71395" PRIMARY KEY ("brand_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_76b5a0609af83035e62df20727" ON "manufacturers"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ce869f6ec0f74a01294b851796" ON "manufacturers"  ("segment") `,
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
    await queryRunner.query(
      `ALTER TABLE "manufacturers" ADD CONSTRAINT "FK_fce6b7d542fc728e866f7d71395" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manufacturers" DROP CONSTRAINT "FK_fce6b7d542fc728e866f7d71395"`,
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
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ce869f6ec0f74a01294b851796"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_76b5a0609af83035e62df20727"`,
    );
    await queryRunner.query(`DROP TABLE "manufacturers"`);
  }
}
