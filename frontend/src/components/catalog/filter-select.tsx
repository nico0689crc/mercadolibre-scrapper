"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Select de la barra de filtros.
 *
 * El Select de shadcn es un popover de Radix, no un <select>: no manda nada al
 * form por si solo, asi que el valor viaja en un input hidden. El valor vacio
 * es siempre `any`, que es lo que `applyFiltersAction` descarta al armar la url
 * (Radix ademas prohibe un item con value="").
 */
export function FilterSelect({
  id,
  name,
  options,
  defaultValue = "any",
  placeholder,
}: {
  id: string;
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  // Navegar entre urls de la misma ruta (un chip, el paginado) reusa esta
  // instancia: sin esto el select seguiria mostrando el filtro anterior.
  const [previous, setPrevious] = useState(defaultValue);
  if (previous !== defaultValue) {
    setPrevious(defaultValue);
    setValue(defaultValue);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
