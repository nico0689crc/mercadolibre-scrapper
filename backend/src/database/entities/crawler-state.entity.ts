import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Estado del llenado progresivo. Una sola fila (id=1): asi el crawler recuerda
 * si estaba corriendo despues de un reinicio del contenedor.
 */
@Entity('crawler_state')
export class CrawlerState {
  @PrimaryColumn({ type: 'integer', default: 1 })
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 32, default: 'catalog' })
  strategy: string;

  @Column({ type: 'integer', default: 6 })
  seeds: number;

  @Column({ type: 'integer', default: 6 })
  pages: number;

  /** Pausa entre categorias. Es el freno principal del ritmo. */
  @Column({ name: 'delay_seconds', type: 'integer', default: 30 })
  delaySeconds: number;

  /** Re-escanea una categoria solo si su ultimo scan es mas viejo que esto. */
  @Column({ name: 'restale_days', type: 'integer', default: 7 })
  restaleDays: number;

  @Column({
    name: 'last_category_id',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  lastCategoryId: string | null;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
