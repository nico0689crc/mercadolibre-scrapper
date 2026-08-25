import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Consumo mensual de cada API de busqueda. Vive en la base y no en memoria
 * para que sobreviva a un reinicio: si no, cada deploy reiniciaria el contador
 * y el corte no serviria de nada.
 */
@Entity('search_quota')
export class SearchQuota {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  provider: string;

  /** Periodo YYYY-MM. La clave compuesta hace que cada mes arranque de cero. */
  @PrimaryColumn({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'integer', default: 0 })
  used: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
