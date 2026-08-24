import { Controller, Get, Param, Query } from '@nestjs/common';

import { CategoriesService } from './categories.service';
import type {
  CategoryBrands,
  CategoryDetail,
  CategoryNode,
  MlAttribute,
  MlCategorySummary,
  MlSite,
} from './category.types';
import { BrandsQueryDto } from './dto/brands-query.dto';
import { SiteQueryDto } from './dto/site-query.dto';
import { TreeQueryDto } from './dto/tree-query.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Sitios de Mercado Libre (MLA, MLB, MLM, ...). */
  @Get('sites')
  getSites(): Promise<MlSite[]> {
    return this.categories.getSites();
  }

  /** Categorias raiz del sitio. */
  @Get()
  getRoots(@Query() query: SiteQueryDto): Promise<MlCategorySummary[]> {
    return this.categories.getRootCategories(query.siteId);
  }

  /** Arbol de categorias, expandido `depth` niveles. */
  @Get('tree')
  getTree(@Query() query: TreeQueryDto): Promise<CategoryNode[]> {
    return this.categories.getTree(query.root, query.depth);
  }

  /** Detalle de una categoria con su path y sus hijas. */
  @Get(':id')
  getOne(@Param('id') id: string): Promise<CategoryDetail> {
    return this.categories.getCategory(id);
  }

  /** Atributos que ML define para la categoria (incluye BRAND). */
  @Get(':id/attributes')
  getAttributes(@Param('id') id: string): Promise<MlAttribute[]> {
    return this.categories.getAttributes(id);
  }

  /** Marcas detectadas en la categoria. Ver BrandsQueryDto por las estrategias. */
  @Get(':id/brands')
  getBrands(
    @Param('id') id: string,
    @Query() query: BrandsQueryDto,
  ): Promise<CategoryBrands> {
    return this.categories.getBrands(
      id,
      query.strategy,
      query.seeds,
      query.pages,
    );
  }
}
