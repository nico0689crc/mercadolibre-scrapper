import { MigrationInterface, QueryRunner } from 'typeorm';

export class CrawlerState1787591164145 implements MigrationInterface {
  name = 'CrawlerState1787591164145';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "crawler_state" ("id" integer NOT NULL DEFAULT '1', "enabled" boolean NOT NULL DEFAULT false, "strategy" character varying(32) NOT NULL DEFAULT 'catalog', "seeds" integer NOT NULL DEFAULT '6', "pages" integer NOT NULL DEFAULT '6', "delay_seconds" integer NOT NULL DEFAULT '30', "restale_days" integer NOT NULL DEFAULT '7', "last_category_id" character varying(32), "last_run_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a381a2e870a304f6a5c95a26ad" PRIMARY KEY ("id"))`,
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
    await queryRunner.query(`DROP TABLE "crawler_state"`);
  }
}
