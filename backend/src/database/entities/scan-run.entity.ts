import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ScanStatus = 'running' | 'ok' | 'error';

/** Bitacora de cada peticion de scan a ML: que se pidio, que trajo, cuanto tardo. */
@Entity('scan_runs')
export class ScanRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'category_id', type: 'varchar', length: 32 })
  categoryId: string;

  @Column({ type: 'varchar', length: 32 })
  strategy: string;

  @Column({ type: 'integer', default: 0 })
  seeds: number;

  @Column({ type: 'integer', default: 0 })
  pages: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  keywords: string[];

  /** false cuando la categoria cayo al fallback sin filtro de dominio. */
  @Column({ name: 'domain_filtered', type: 'boolean', default: false })
  domainFiltered: boolean;

  /** Productos de catalogo analizados en esta corrida. */
  @Column({ type: 'integer', default: 0 })
  sampled: number;

  @Column({ name: 'brands_found', type: 'integer', default: 0 })
  brandsFound: number;

  /** Marcas que esta corrida agrego y que no estaban antes en la categoria. */
  @Column({ name: 'brands_new', type: 'integer', default: 0 })
  brandsNew: number;

  /** Productos de catalogo guardados o actualizados por esta corrida. */
  @Column({ name: 'products_stored', type: 'integer', default: 0 })
  productsStored: number;

  @Column({ name: 'duration_ms', type: 'integer', default: 0 })
  durationMs: number;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'running' })
  status: ScanStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
