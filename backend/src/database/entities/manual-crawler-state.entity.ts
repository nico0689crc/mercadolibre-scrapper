import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Estado del worker de manuales. Una sola fila (id=1), igual que crawler_state:
 * tiene que sobrevivir a un reinicio porque este worker espera horas hasta que
 * se abra la ventana horaria que pide el fabricante.
 */
@Entity('manual_crawler_state')
export class ManualCrawlerState {
  @PrimaryColumn({ type: 'integer', default: 1 })
  id: number;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  /** Dias tras los cuales se vuelve a recorrer el sitio de un fabricante. */
  @Column({ name: 'restale_days', type: 'integer', default: 30 })
  restaleDays: number;

  /** Descargar cada PDF para confirmarlo. Apagarlo acelera pero da menos certeza. */
  @Column({ type: 'boolean', default: true })
  verify: boolean;

  @Column({ name: 'last_brand_id', type: 'uuid', nullable: true })
  lastBrandId: string | null;

  @Column({
    name: 'last_brand_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  lastBrandName: string | null;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  /** Cuando el fabricante pide una franja horaria y estamos fuera de ella. */
  @Column({ name: 'waiting_for_window', type: 'boolean', default: false })
  waitingForWindow: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
