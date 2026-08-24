"use client";

import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryNode } from "@/types/api";

const NIVELES = ["Categoria", "Subcategoria", "Sub-subcategoria"];

function nivel(profundidad: number): string {
  return NIVELES[profundidad] ?? `Nivel ${profundidad + 1}`;
}

/**
 * Cascada de categorias: cada select se llena con las hijas de lo elegido en el
 * de arriba, y se agrega uno nuevo mientras la categoria elegida tenga hijas.
 *
 * Al backend viaja un solo parametro, `branch`, con la categoria mas profunda
 * elegida: el filtro resuelve la rama entera con el `path`, asi que elegir un
 * nivel intermedio incluye todo lo que cuelga de el.
 *
 * El arbol completo (~500 nodos) llega de una y se filtra en memoria: cambiar
 * de nivel no cuesta un request.
 */
export function CategoryCascade({
  nodes,
  value,
  name = "branch",
}: {
  nodes: CategoryNode[];
  value?: string;
  name?: string;
}) {
  const { byId, byParent } = useMemo(() => {
    const byId = new Map<string, CategoryNode>();
    const byParent = new Map<string, CategoryNode[]>();

    for (const node of nodes) {
      byId.set(node.id, node);
      const key = node.parentId ?? "";
      const siblings = byParent.get(key);
      if (siblings) siblings.push(node);
      else byParent.set(key, [node]);
    }
    return { byId, byParent };
  }, [nodes]);

  // La cadena inicial sale de subir por parent_id desde la categoria filtrada.
  const initial = useMemo(() => {
    const chain: string[] = [];
    let current = value ? byId.get(value) : undefined;
    while (current) {
      chain.unshift(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }, [value, byId]);

  const [chain, setChain] = useState<string[]>(initial);
  // Idem: si la url cambia de rama (un chip, un link), la cascada tiene que
  // reflejar la nueva y no la que el usuario habia elegido antes.
  const [previous, setPrevious] = useState(value);
  if (previous !== value) {
    setPrevious(value);
    setChain(initial);
  }

  // Un select por nivel: las raices, y las hijas de cada elegido.
  const levels: { options: CategoryNode[]; selected: string }[] = [
    { options: byParent.get("") ?? [], selected: chain[0] ?? "any" },
  ];
  for (let index = 0; index < chain.length; index += 1) {
    const children = byParent.get(chain[index]) ?? [];
    if (children.length === 0) break;
    levels.push({ options: children, selected: chain[index + 1] ?? "any" });
  }

  const pick = (level: number, id: string) => {
    // Elegir "todas" en un nivel borra ese nivel y los de abajo.
    setChain(id === "any" ? chain.slice(0, level) : [...chain.slice(0, level), id]);
  };

  const deepest = chain[chain.length - 1] ?? "";
  const leaf = deepest ? byId.get(deepest) : undefined;

  return (
    <>
      <input type="hidden" name={name} value={deepest} />

      {levels.map((level, index) => (
        <div key={index} className="space-y-2">
          <Label htmlFor={`${name}-${index}`}>{nivel(index)}</Label>
          <Select value={level.selected} onValueChange={(id) => pick(index, id)}>
            <SelectTrigger id={`${name}-${index}`} className="w-full">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Todas</SelectItem>
              {level.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {index === levels.length - 1 ? (
            <p className="text-muted-foreground text-xs">
              {leaf
                ? `Incluye ${leaf.name} y todo lo que cuelgue de ella.`
                : "Elegi una categoria para acotar, o dejalo en todas."}
            </p>
          ) : null}
        </div>
      ))}
    </>
  );
}
