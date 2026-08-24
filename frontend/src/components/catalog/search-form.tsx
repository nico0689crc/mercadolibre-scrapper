import { Search } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

/**
 * Busqueda por texto de una tabla paginada. Es un form GET: los filtros que hay
 * que conservar viajan como hidden y el `offset` queda afuera a proposito, asi
 * una busqueda nueva empieza en la primera pagina.
 */
export function SearchForm({
  action,
  hidden,
  defaultValue,
  placeholder,
}: {
  action: string;
  hidden: Record<string, string>;
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <form action={action} className="w-full max-w-sm">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="secondary">
            Buscar
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
