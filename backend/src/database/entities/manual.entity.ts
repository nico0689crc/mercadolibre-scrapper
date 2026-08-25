import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Brand } from './brand.entity';

/**
 * Manual oficial de un modelo.
 *
 * La clave es (marca, modelo) y no el producto: un mismo PDF cubre varios
 * modelos de una linea (el de la linea ECO de Drean cubre once), asi que
 * indexarlo por producto multiplicaria el trabajo sin agregar informacion.
 */
@Entity('manuals')
@Unique(['brandId', 'model'])
export class Manual {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'brand_id', type: 'uuid' })
  brandId: string;

  /** Modelo normalizado: mayusculas y sin separadores, para poder matchear. */
  @Index()
  @Column({ type: 'varchar', length: 64 })
  model: string;

  /** El modelo tal como lo publica el fabricante, sin normalizar. */
  @Column({ name: 'model_raw', type: 'varchar', length: 128 })
  modelRaw: string;

  @Column({ type: 'text' })
  url: string;

  /** Dominio del que salio. Tiene que ser uno de los oficiales de la marca. */
  @Column({ name: 'source_domain', type: 'varchar', length: 128 })
  sourceDomain: string;

  /** Pagina donde se encontro el enlace, para poder auditar el hallazgo. */
  @Column({ name: 'found_at_url', type: 'text', nullable: true })
  foundAtUrl: string | null;

  @Column({ name: 'content_type', type: 'varchar', length: 64, nullable: true })
  contentType: string | null;

  @Column({ type: 'integer', nullable: true })
  bytes: number | null;

  /** Identifica el archivo: el mismo PDF sirviendo a varios modelos comparte hash. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  sha256: string | null;

  /** Se confirmo que la URL devuelve un PDF de verdad. */
  @Column({ type: 'boolean', default: false })
  verified: boolean;

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt: Date | null;

  @ManyToOne(() => Brand, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
