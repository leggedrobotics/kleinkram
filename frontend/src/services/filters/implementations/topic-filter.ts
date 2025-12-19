import TopicFilterComponent from 'src/components/files/filter/components/topic-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import {
    Suggestion,
    SuggestionContext,
} from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class TopicFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(KEYWORDS.TOPIC, 'Topic', 'sym_o_topic', TopicFilterComponent);
    }

    parse(tokenValue: string, state: FilterState): void {
        if (tokenValue) state.selectedTopics.push(tokenValue);
    }

    override getSuggestions(
        context: SuggestionContext<FileSearchContextData>,
    ): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        if (
            !lowerLast.startsWith(this.key) &&
            !this.key.startsWith(lowerLast)
        ) {
            return [];
        }

        const list: Suggestion[] = [];

        if (lowerLast.startsWith(this.key)) {
            let query = lowerLast.slice(this.key.length);
            if (query.startsWith('"')) query = query.slice(1);

            const items = context.data.topics;
            for (const item of items
                .filter((index) => index.toLowerCase().includes(query))
                .slice(0, 5)) {
                const label = item.includes(' ') ? `"${item}"` : item;
                list.push(
                    this.createSuggestion({
                        label,
                        value: item,
                        prefix: this.key,
                        description: 'Topic',
                        icon: this.icon,
                        appendSpace: true,
                        disabled: false,
                    }),
                );
            }
        }

        return list;
    }
}
