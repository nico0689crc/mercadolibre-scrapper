import { MigrationInterface, QueryRunner } from 'typeorm';

export class ManualMatchReason1787670832715 implements MigrationInterface {
  name = 'ManualMatchReason1787670832715';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "manuals" ADD "match_reason" character varying(16)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "manuals" DROP COLUMN "match_reason"`);
  }
}
