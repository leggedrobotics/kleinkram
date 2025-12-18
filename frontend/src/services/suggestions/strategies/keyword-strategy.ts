import { Suggestion, SuggestionContext } from '../suggestion-types';
import { BaseStrategy } from './base-strategy';

export class KeywordStrategy<T> extends BaseStrategy<T> {
    constructor(
        private keywords: Record<string, string>,
        private rules?: Record<
            string,
            (context: SuggestionContext<T>) => {
                enabled: boolean;
                reason?: string;
                hidden?: boolean;
            }
        >,
    ) {
        super();
    }

    getSuggestions(context: SuggestionContext<T>): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        // If we are ALREADY typing a value (contains :), keywords are not suggestions
        if (lastWord.includes(':')) return [];

        const list: Suggestion[] = [];

        for (const [key, prefix] of Object.entries(this.keywords)) {
            // Allow matching "topic" to "&topic:" (ignore leading &)
            // This allows suggestions for the "AND" variant even if user just types "topic"
            const matches =
                prefix.startsWith(lowerLast) ||
                (prefix.startsWith('&') &&
                    prefix.slice(1).startsWith(lowerLast));

            if (matches) {
                let disabled = false;
                let desc = `Filter by ${key.toLowerCase()}`;

                // Check rules
                if (this.rules?.[prefix]) {
                    const ruleResult = this.rules[prefix](context);
                    if (ruleResult.hidden) {
                        continue;
                    }
                    if (!ruleResult.enabled) {
                        disabled = true;
                        desc = ruleResult.reason ?? desc;
                    }
                }

                list.push(
                    this.createSuggestion({
                        label: '',
                        value: '',
                        prefix,
                        description: desc,
                        icon: 'sym_o_filter_alt',
                        appendSpace: false,
                        disabled,
                    }),
                );
            }
        }

        return list;
    }
}
