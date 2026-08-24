import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductsStored1787590723575 implements MigrationInterface {
  name = 'ProductsStored1787590723575';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ADD "products_stored" integer NOT NULL DEFAULT '0'`,
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
      `ALTER TABLE "scan_runs" DROP COLUMN "products_stored"`,
    );
  }
}
