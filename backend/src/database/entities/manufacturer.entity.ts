import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Brand } from './brand.entity';

/**
 * `candidate` sale del filtro automatico, `verified` exige evidencia (un manual
 * bajado de un dominio oficial), `rejected` es basura de marketplace.
 */
export type ManufacturerStatus = 'candidate' | 'verified' | 'rejected';

/**
 * Marca a la que le reconocemos identidad de fabricante.
 *
 * Vive aparte de `brands` porque son cosas distintas: `brands` es lo que dice
 * ML (incluye vendedores, marcas propias de retail y basura literal), y esto es
 * el subconjunto sobre el que tiene sentido buscar manuales oficiales.
 */
@Entity('manufacturers')
export class Manufacturer {
  @PrimaryColumn({ name: 'brand_id', type: 'uuid' })
  brandId: string;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'candidate' })
  status: ManufacturerStatus;

  /** Segmento en el que se lo detecto, ej. white_goods. */
  @Index()
  @Column({ type: 'varchar', length: 32 })
  segment: string;

  /** Dominios oficiales, ej. ["drean.com.ar"]. De aca sale el manual. */
  @Column({
    name: 'official_domains',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  officialDomains: string[];

  /** URL de un manual efectivamente descargado: es lo que justifica `verified`. */
  @Column({ name: 'evidence_url', type: 'text', nullable: true })
  evidenceUrl: string | null;

  /** Por que se acepto o se rechazo. */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Contadores que motivaron la candidatura, congelados al momento de detectarla. */
  @Column({ type: 'integer', default: 0 })
  products: number;

  @Column({ type: 'integer', default: 0 })
  models: number;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @OneToOne(() => Brand, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
