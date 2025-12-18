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
                // Find all tag UUIDs ignoring case
                const tags = context.availableTags.filter(
                    (t) => t.name.toLowerCase() === mKey.toLowerCase(),
                );

                if (tags.length > 0) {
                    for (const tag of tags) {
                        state.tagFilter[tag.uuid] = {
                            name: tag.name,
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
        const availableTags = context.data.availableTags;

        // Operators
        const exactTag = availableTags.find(
            (t) => t.name.toLowerCase() === metaPart,
        );
        if (exactTag) {
            for (const op of ['=', '!=', '>', '<', '>=', '<=']) {
                list.push(
                    this.createSuggestion({
                        label: op,
                        value: op,
                        prefix: this.key + exactTag.name,
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
        for (const tag of availableTags) {
            const tagNameLower = tag.name.toLowerCase();
            if (tagNameLower.includes(metaPart) && tagNameLower !== metaPart) {
                if (seenNames.has(tagNameLower)) continue;

                list.push(
                    this.createSuggestion({
                        label: tag.name,
                        value: tag.name + '=',
                        prefix: this.key,
                        description: `Metadata: ${tag.datatype}`,
                        icon: 'sym_o_label',
                        appendSpace: false,
                        disabled: false,
                    }),
                );
                seenNames.add(tagNameLower);
            }
        }

        // All keys if empty
        if (metaPart === '') {
            const seenNames = new Set<string>();
            for (const tag of availableTags) {
                if (seenNames.has(tag.name.toLowerCase())) continue;

                list.push(
                    this.createSuggestion({
                        label: tag.name,
                        value: tag.name + '=',
                        prefix: this.key,
                        description: `Metadata: ${tag.datatype}`,
                        icon: 'sym_o_label',
                        appendSpace: false,
                        disabled: false,
                    }),
                );
                seenNames.add(tag.name.toLowerCase());

                if (list.length >= 50) break;
            }
        }

        return list;
    }
}
