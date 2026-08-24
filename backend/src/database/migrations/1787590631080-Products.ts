import { MigrationInterface, QueryRunner } from 'typeorm';

export class Products1787590631080 implements MigrationInterface {
  name = 'Products1787590631080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "products" ("id" character varying(32) NOT NULL, "site_id" character varying(8) NOT NULL, "domain_id" character varying(128), "category_id" character varying(32), "brand_id" uuid, "name" character varying(512) NOT NULL, "status" character varying(32) NOT NULL DEFAULT 'active', "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d39fc5d53b4f8c9254fc136869" ON "products"  ("domain_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a5f6868c96e0069e699f33e12" ON "products"  ("category_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1530a6f15d3c79d1b70be98f2b" ON "products"  ("brand_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b6008cea8d49f22f749e8ed8a8" ON "products"  ("category_id", "brand_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ALTER COLUMN "keywords" SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ALTER COLUMN "keywords" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "path" SET DEFAULT '[]'`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b6008cea8d49f22f749e8ed8a8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1530a6f15d3c79d1b70be98f2b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a5f6868c96e0069e699f33e12"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d39fc5d53b4f8c9254fc136869"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
  }
}
