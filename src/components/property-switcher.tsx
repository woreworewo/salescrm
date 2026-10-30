"use client";
import { useActionState, useState } from "react";
import { switchProperty } from "@/app/actions";
import { INITIAL_STATE, type PropertyOption } from "@/lib/models";
import { Button } from "./ui/button";
import { Feedback } from "./forms";

export function PropertySwitcher({
  options,
  activeId,
}: {
  options: PropertyOption[];
  activeId?: string;
}) {
  const [selected, setSelected] = useState(activeId ?? "");
  const [state, action, pending] = useActionState(
    switchProperty,
    INITIAL_STATE,
  );
  const tenants = [
    ...new Map(options.map((p) => [p.tenant_id, p.tenant_name])).entries(),
  ];
  return (
    <form action={action} className="w-full space-y-2 sm:max-w-md">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          Organisasi / Property
          <select
            name="property_id"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            required
            disabled={pending}
            className="!mt-1 !py-2 !text-xs"
          >
            <option value="" disabled>
              Pilih property
            </option>
            {tenants.map(([id, name]) => (
              <optgroup key={id} label={name}>
                {options
                  .filter((p) => p.tenant_id === id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {name} / {p.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          size="sm"
          className="mb-0.5"
          type="submit"
          disabled={pending || !selected || selected === activeId}
        >
          {pending ? "Beralih…" : "Buka"}
        </Button>
      </div>
      {selected !== activeId && selected && (
        <p className="text-[11px] text-slate-500">
          Beralih membuka Overview; isi form yang belum disimpan tidak ikut
          dipindahkan.
        </p>
      )}
      <Feedback state={state} />
    </form>
  );
}
