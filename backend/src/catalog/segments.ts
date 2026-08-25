/**
 * Recortes del catalogo donde buscar fabricantes tiene sentido.
 *
 * La lista es explicita a proposito: un regex sobre `domain_id` arrastra
 * utensilios de cocina, juguetes y repuestos, que no son linea blanca.
 */
export const SEGMENTS: Record<string, { label: string; domains: string[] }> = {
  white_goods: {
    label: 'Linea blanca',
    domains: [
      'MLA-WASHING_MACHINES',
      'MLA-MINI_WASHING_MACHINES',
      'MLA-DRYER_MACHINES',
      'MLA-REFRIGERATORS',
      'MLA-EXHIBITOR_REFRIGERATORS',
      'MLA-FREEZERS',
      'MLA-EXHIBITOR_FREEZERS',
      'MLA-DISHWASHERS',
      'MLA-OVENS',
      'MLA-RANGES',
      'MLA-COOKTOPS',
      'MLA-MICROWAVES',
      'MLA-KITCHEN_RANGE_HOODS',
      'MLA-AIR_CONDITIONERS',
      'MLA-WATER_HEATERS',
      'MLA-STORAGE_WATER_HEATERS',
    ],
  },
};

export function segmentDomains(segment: string): string[] {
  return SEGMENTS[segment]?.domains ?? [];
}
