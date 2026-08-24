import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CategoryBrand } from './category-brand.entity';

/** Nodo del arbol de categorias de ML, tal como lo devuelve /categories/{id}. */
@Entity('categories')
export class Category {
  /** Id de ML, ej. MLA1055. */
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Index()
  @Column({ name: 'site_id', type: 'varchar', length: 8 })
  siteId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index()
  @Column({ name: 'parent_id', type: 'varchar', length: 32, nullable: true })
  parentId: string | null;

  @Column({ name: 'total_items', type: 'integer', default: 0 })
  totalItems: number;

  /** settings.catalog_domain, ej. MLA-CELLPHONES. Null si ML no lo define. */
  @Column({
    name: 'catalog_domain',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  catalogDomain: string | null;

  @Column({ name: 'is_leaf', type: 'boolean', default: false })
  isLeaf: boolean;

  /** 0 = raiz. Permite listar un nivel sin recorrer el arbol. */
  @Index()
  @Column({ type: 'integer', default: 0 })
  depth: number;

  /** path_from_root de ML, guardado tal cual para no re-resolverlo. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  path: { id: string; name: string }[];

  /** Ultima vez que se trajo esta categoria desde ML. */
  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;

  @OneToMany(() => CategoryBrand, (cb) => cb.category)
  brands: CategoryBrand[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
