/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Margins } from "@utils/margins";
import { wordsFromCamel, wordsToTitle } from "@utils/text";
import { PluginOptionMultiSelect } from "@utils/types";
import { Forms, React, Select } from "@webpack/common";

import { ISettingElementProps } from ".";

export function SettingMultiSelectComponent({
    option,
    pluginSettings,
    definedSettings,
    onChange,
    onError,
    id
}: ISettingElementProps<PluginOptionMultiSelect>) {
    const def = pluginSettings[id] ?? option.options?.filter(o => o.default).map(o => o.value);

    const [state, setState] = React.useState<any>(def ?? []);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        onError(error !== null);
    }, [error]);

    function handleChange(newValue) {
        const isValid = option.isValid?.call(definedSettings, newValue) ?? true;
        if (typeof isValid === "string") setError(isValid);
        else if (!isValid) setError("Invalid input provided.");
        else {
            setError(null);
            setState(newValue);
            onChange(newValue);
        }
    }

    return (
        <Forms.FormSection>
            <Forms.FormTitle>{wordsToTitle(wordsFromCamel(id))}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom16} type="description">{option.description}</Forms.FormText>
            <Select
                isDisabled={option.disabled?.call(definedSettings) ?? false}
                options={option.options}
                placeholder={option.placeholder ?? "Select an option"}
                maxVisibleItems={5}
                closeOnSelect={false}
                select={newValue => {
                    if (state instanceof Array) { // if the dev changed from a single select to a multi select at some point, this might not be an array
                        state.includes(newValue) ? handleChange(state.filter(v => v !== newValue)) : handleChange([...state, newValue]);
                    } else {
                        handleChange([state, newValue]);
                    }
                }}
                isSelected={v => {
                    if (state instanceof Array) { // if the dev changed from a single select to a multi select at some point, this might not be an array
                        return state.includes(v);
                    } else {
                        return v === state;
                    }
                }}
                serialize={v => String(v)}
                clear={() => {
                    handleChange([]);
                }}
                {...option.componentProps}
            />
            {error && <Forms.FormText style={{ color: "var(--text-danger)" }}>{error}</Forms.FormText>}
        </Forms.FormSection>
    );
}
