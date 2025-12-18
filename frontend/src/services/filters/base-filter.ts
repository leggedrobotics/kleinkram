import {
    Suggestion,
    SuggestionConfig,
    SuggestionContext,
} from 'src/services/suggestions/suggestion-types';
import { Component } from 'vue';

import { Filter } from './filter-interface';

export abstract class BaseFilter<TState, TContext> implements Filter<
    TState,
    TContext
> {
    protected constructor(
        public key: string,
        public label: string,
        public icon: string,
        public advancedComponent?: Component,
    ) {}

    abstract parse(tokenValue: string, state: TState, context: TContext): void;

    /**
     * Override this to provide items for the default getSuggestions implementation.
     * If not overridden, getSuggestions must be overridden.
     */
    protected getSuggestionItems(
        _context: SuggestionContext<TContext>,
    ): { name: string }[] | string[] {
        return [];
    }

    getSuggestions(context: SuggestionContext<TContext>): Suggestion[] {
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

            const items = this.getSuggestionItems(context);
            if (items.length === 0) return [];

            for (const item of items) {
                const itemName = typeof item === 'string' ? item : item.name;
                if (!itemName) continue;

                if (itemName.toLowerCase().includes(query)) {
                    const label = itemName.includes(' ')
                        ? `"${itemName}"`
                        : itemName;
                    list.push(
                        this.createSuggestion({
                            label,
                            value: itemName,
                            prefix: this.key,
                            description: this.label,
                            icon: this.icon,
                            appendSpace: true,
                            disabled: false,
                        }),
                    );
                }
                if (list.length >= 5) break;
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
