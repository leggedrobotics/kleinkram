import {
    Suggestion,
    SuggestionConfig,
    SuggestionContext,
} from 'src/services/suggestions/suggestion-types';
import { Component, markRaw } from 'vue';

import { Filter } from './filter-interface';

export interface NormalizedSuggestionItem {
    name: string;
    description?: string;
}

export abstract class BaseFilter<TState, TContext> implements Filter<
    TState,
    TContext
> {
    protected suggestionLimit = 8;

    protected constructor(
        public key: string,
        public label: string,
        public icon: string,
        public advancedComponent?: Component,
    ) {
        if (this.advancedComponent) {
            this.advancedComponent = markRaw(this.advancedComponent);
        }
    }

    /**
     * Parse the token value and update the state accordingly.
     * @param tokenValue
     * @param state
     * @param context
     */
    abstract parse(
        tokenValue: string,
        state: TState,
        context: Readonly<TContext>,
    ): void;

    /**
     * Override this to provide items for the default getSuggestions implementation.
     * If not overridden, getSuggestions must be overridden.
     *
     * @return An array of suggestion items or strings.
     * @param _context
     */
    protected getSuggestionItems(
        _context: SuggestionContext<TContext>,
    ): NormalizedSuggestionItem[] | string[] {
        return [];
    }

    private getNormalizedItems(
        context: SuggestionContext<TContext>,
    ): NormalizedSuggestionItem[] {
        const items = this.getSuggestionItems(context);
        if (items.length === 0) return [];

        if (typeof items[0] === 'string') {
            return (items as string[]).map((item) => ({
                name: item,
                description: this.label,
            }));
        }
        return items as NormalizedSuggestionItem[];
    }

    getSuggestions(context: SuggestionContext<TContext>): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        if (!lowerLast.startsWith(this.key.toLowerCase())) {
            return [];
        }

        let query = lowerLast.slice(this.key.length);
        const isQuoted = query.startsWith('"');
        if (isQuoted) {
            // Remove surrounding quotes
            query = query.replaceAll(/^"|"$/g, '');
        }

        const items = this.getNormalizedItems(context);
        const list: Suggestion[] = [];

        for (const item of items) {
            if (list.length >= this.suggestionLimit) break;

            if (item.name.toLowerCase().includes(query)) {
                const label = item.name.includes(' ')
                    ? `"${item.name}"`
                    : item.name;

                list.push(
                    this.createSuggestion({
                        label,
                        value: item.name,
                        prefix: this.key,
                        description: item.description ?? this.label,
                        icon: this.icon,
                        appendSpace: true,
                        disabled: false,
                    }),
                );
            }
        }

        return list;
    }

    protected getLastWord(input: string): string {
        const lastWordRegex =
            /([a-zA-Z0-9_-]+:"[^"]*|[a-zA-Z0-9_:=><!\/.\-@#~"]+)$/;
        const match = lastWordRegex.exec(input);
        return match ? (match[1] ?? '') : '';
    }

    protected createSuggestion(config: SuggestionConfig): Suggestion {
        return {
            label: config.label,
            value: config.value,
            prefix: config.prefix,
            description: config.description,
            icon: config.icon,
            appendSpace: config.appendSpace ?? true,
            disabled: config.disabled ?? false,
        };
    }
}
