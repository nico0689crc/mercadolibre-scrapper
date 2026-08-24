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
 * Marca vista en una categoria. Es la tabla que acumula: cada scan hace upsert
 * y suma, asi la cobertura crece entre corridas en vez de perderse.
 */
@Entity('category_brands')
@Index(['categoryId', 'products'])
export class CategoryBrand {
  @PrimaryColumn({ name: 'category_id', type: 'varchar', length: 32 })
  categoryId: string;

  @PrimaryColumn({ name: 'brand_id', type: 'uuid' })
  brandId: string;

  /** Productos de catalogo con esta marca vistos en el ultimo scan. */
  @Column({ type: 'integer', default: 0 })
  products: number;

  /** Maximo historico de `products`: no baja si un scan chico ve menos. */
  @Column({ name: 'products_max', type: 'integer', default: 0 })
  productsMax: number;

  /** Cuantos scans distintos encontraron esta marca en esta categoria. */
  @Column({ type: 'integer', default: 0 })
  occurrences: number;

  @Column({ name: 'first_seen_at', type: 'timestamptz' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @ManyToOne(() => Category, (c) => c.brands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Brand, (b) => b.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
