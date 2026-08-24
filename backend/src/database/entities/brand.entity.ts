import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CategoryBrand } from './category-brand.entity';

/**
 * Marca global. ML no expone un catalogo de marcas, asi que la identidad sale
 * del `value_id` del atributo BRAND cuando existe (Samsung=206) y del nombre
 * normalizado cuando no. Por eso `mlValueId` es nullable pero unico.
 */
@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true, where: 'ml_value_id IS NOT NULL' })
  @Column({ name: 'ml_value_id', type: 'varchar', length: 32, nullable: true })
  mlValueId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /** Nombre normalizado (minusculas, sin acentos) para deduplicar sin value_id. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @OneToMany(() => CategoryBrand, (cb) => cb.brand)
  categories: CategoryBrand[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
