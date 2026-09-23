import MetadataFilterComponent from 'src/components/files/filter/components/metadata-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import {
    Suggestion,
    SuggestionContext,
} from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class MetadataFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(
            KEYWORDS.METADATA,
            'Metadata',
            'sym_o_label',
            MetadataFilterComponent,
        );
    }

    parse(
        tokenValue: string,
        state: FilterState,
        context: FileSearchContextData,
    ): void {
        if (tokenValue.includes('=')) {
            const [mKey, mValue] = tokenValue.split('=');

            if (mKey && mValue) {
                // Find all metadata type UUIDs ignoring case
                const metadataTypes = context.availableMetadataTypes.filter(
                    (t) => t.name.toLowerCase() === mKey.toLowerCase(),
                );

                if (metadataTypes.length > 0) {
                    for (const metadataType of metadataTypes) {
                        state.metadataFilter[metadataType.uuid] = {
                            name: metadataType.name,
                            value: mValue,
                        };
                    }
                }
            }
        }
    }

    override getSuggestions(
        context: SuggestionContext<FileSearchContextData>,
    ): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        if (!lowerLast.startsWith(this.key)) return [];

        const metaPart = lowerLast.slice(this.key.length);
        const operatorMatch = /([=><!]+)/.exec(metaPart);
        if (operatorMatch) return [];

        const list: Suggestion[] = [];
        const availableMetadataTypes = context.data.availableMetadataTypes;

        // Operators
        const exactMetadataType = availableMetadataTypes.find(
            (t) => t.name.toLowerCase() === metaPart,
        );
        if (exactMetadataType) {
            for (const op of ['=', '!=', '>', '<', '>=', '<=']) {
                list.push(
                    this.createSuggestion({
                        label: op,
                        value: op,
                        prefix: this.key + exactMetadataType.name,
                        description: `Operator ${op}`,
                        icon: 'sym_o_calculate',
                        appendSpace: false,
                        disabled: false,
                    }),
                );
            }
        }

        // Keys
        const seenNames = new Set<string>();
        for (const metadataType of availableMetadataTypes) {
            const nameLower = metadataType.name.toLowerCase();
            if (nameLower.includes(metaPart) && nameLower !== metaPart) {
                if (seenNames.has(nameLower)) continue;

                list.push(
                    this.createSuggestion({
                        label: metadataType.name,
                        value: metadataType.name + '=',
                        prefix: this.key,
                        description: `Metadata: ${metadataType.datatype}`,
                        icon: 'sym_o_label',
                        appendSpace: false,
                        disabled: false,
                    }),
                );
                seenNames.add(nameLower);
            }
        }

        // All keys if empty
        if (metaPart === '') {
            for (const metadataType of availableMetadataTypes) {
                if (seenNames.has(metadataType.name.toLowerCase())) continue;

                list.push(
                    this.createSuggestion({
                        label: metadataType.name,
                        value: metadataType.name + '=',
                        prefix: this.key,
                        description: `Metadata: ${metadataType.datatype}`,
                        icon: 'sym_o_label',
                        appendSpace: false,
                        disabled: false,
                    }),
                );
                seenNames.add(metadataType.name.toLowerCase());

                if (list.length >= 50) break;
            }
        }

        return list;
    }
}
