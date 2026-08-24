import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Brand } from './brand.entity';
import { Category } from './category.entity';

/**
 * Producto de catalogo de ML (los ids tipo MLA63192943), no una publicacion.
 * Salen de /products/search durante los scans: son los mismos productos de los
 * que inferimos la marca, asi que persistirlos no cuesta requests extra.
 */
@Entity('products')
@Index(['categoryId', 'brandId'])
export class Product {
  /** Id del producto de catalogo en ML. */
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ name: 'site_id', type: 'varchar', length: 8 })
  siteId: string;

  /** Dominio canonico del producto, ej. MLA-CELLPHONES. */
  @Index()
  @Column({ name: 'domain_id', type: 'varchar', length: 128, nullable: true })
  domainId: string | null;

  /**
   * Categoria bajo la cual lo encontramos, no la categoria canonica de ML.
   * En scans de categorias raiz (sin filtro de dominio) el producto puede ser
   * de una categoria mas especifica: para eso esta `domainId`, que si es canonico.
   */
  @Index()
  @Column({ name: 'category_id', type: 'varchar', length: 32, nullable: true })
  categoryId: string | null;

  @Index()
  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @Column({ type: 'varchar', length: 512 })
  name: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  // --- Detalle que YA viene en /products/search: no cuesta requests extra ---

  @Column({ type: 'text', nullable: true })
  thumbnail: string | null;

  @Column({ name: 'short_description', type: 'text', nullable: true })
  shortDescription: string | null;

  /** Los ~85 atributos del producto, tal como los da ML. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  attributes: {
    id: string;
    name: string;
    value_id?: string | null;
    value_name?: string | null;
  }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  pictures: { id: string; url: string }[];

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @Column({ name: 'quality_type', type: 'varchar', length: 32, nullable: true })
  qualityType: string | null;

  @Column({ name: 'parent_id', type: 'varchar', length: 32, nullable: true })
  parentId: string | null;

  @Column({ name: 'children_count', type: 'integer', default: 0 })
  childrenCount: number;

  @Column({ name: 'ml_date_created', type: 'timestamptz', nullable: true })
  mlDateCreated: Date | null;

  @Column({ name: 'ml_last_updated', type: 'timestamptz', nullable: true })
  mlLastUpdated: Date | null;

  // --- Detalle que exige llamadas propias: se trae a demanda y se cachea ---

  @Column({ type: 'text', nullable: true })
  permalink: string | null;

  /** main_features de /products/{id}. */
  @Column({
    name: 'main_features',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  mainFeatures: string[];

  /** Publicaciones activas del producto, de /products/{id}/items. */
  @Column({ name: 'listings_count', type: 'integer', nullable: true })
  listingsCount: number | null;

  @Column({ name: 'sellers_count', type: 'integer', nullable: true })
  sellersCount: number | null;

  @Column({
    name: 'price_min',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  priceMin: string | null;

  @Column({
    name: 'price_max',
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  priceMax: string | null;

  @Column({ name: 'currency_id', type: 'varchar', length: 8, nullable: true })
  currencyId: string | null;

  /** Null = nunca se pidio el detalle. Marca la frescura del cache. */
  @Column({ name: 'detail_fetched_at', type: 'timestamptz', nullable: true })
  detailFetchedAt: Date | null;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
