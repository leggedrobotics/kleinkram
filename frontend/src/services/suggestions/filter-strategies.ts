import {
    Suggestion,
    SuggestionContext,
    SuggestionProvider,
} from './suggestion-types';

export abstract class BaseStrategy<T> implements SuggestionProvider<T> {
    abstract getSuggestions(context: SuggestionContext<T>): Suggestion[];

    protected getLastWord(input: string): string {
        const lastWordRegex =
            /((?:[a-zA-Z0-9_-]+:"[^"]*)|(?:[a-zA-Z0-9_:=><!/.\-@#~"]+))$/;
        const match = lastWordRegex.exec(input);
        return match ? (match[1] ?? '') : '';
    }

    protected createSuggestion(
        label: string,
        value: string,
        prefix: string,
        desc: string,
        icon: string,
        appendSpace = true,
        disabled = false,
    ): Suggestion {
        return {
            label,
            value,
            prefix,
            description: desc,
            icon,
            appendSpace,
            disabled,
        };
    }
}

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
                    this.createSuggestion(
                        '',
                        '',
                        prefix,
                        desc,
                        'sym_o_filter_alt',
                        false,
                        disabled,
                    ),
                );
            }
        }

        return list;
    }
}

export class ValueStrategy<T> extends BaseStrategy<T> {
    constructor(
        private keyword: string,
        private icon: string,
        private description: string,
        private getItems: (context: SuggestionContext<T>) => { name: string }[],
        private dependencyCheck?: (context: SuggestionContext<T>) => boolean,
    ) {
        super();
    }

    getSuggestions(context: SuggestionContext<T>): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        // We only match if the start matches the keyword
        if (
            !lowerLast.startsWith(this.keyword) &&
            !this.keyword.startsWith(lowerLast)
        ) {
            return [];
        }

        const list: Suggestion[] = [];

        if (lowerLast.startsWith(this.keyword)) {
            let query = lowerLast.slice(this.keyword.length);
            if (query.startsWith('"')) {
                query = query.slice(1);
            }

            const disabled = this.dependencyCheck
                ? !this.dependencyCheck(context)
                : false;

            const items = this.getItems(context);

            for (const item of items
                .filter((index) =>
                    (index.name || '').toLowerCase().includes(query),
                )
                .slice(0, 5)) {
                const itemName = item.name || '';
                const label = itemName.includes(' ')
                    ? `"${itemName}"`
                    : itemName;

                list.push(
                    this.createSuggestion(
                        label,
                        itemName,
                        this.keyword,
                        this.description,
                        this.icon,
                        true,
                        disabled,
                    ),
                );
            }
        }

        return list;
    }
}

export interface MetadataTag {
    name: string;
    datatype: string;
}

export class GenericMetadataStrategy<T> extends BaseStrategy<T> {
    constructor(
        private prefix: string,
        private getTags: (context: SuggestionContext<T>) => MetadataTag[],
    ) {
        super();
    }

    getSuggestions(context: SuggestionContext<T>): Suggestion[] {
        const lastWord = this.getLastWord(context.input);
        const lowerLast = lastWord.toLowerCase();

        if (!lowerLast.startsWith(this.prefix)) return [];

        const metaPart = lowerLast.slice(this.prefix.length);
        const operatorMatch = /([=><!]+)/.exec(metaPart);
        if (operatorMatch) return [];

        const list: Suggestion[] = [];
        const availableTags = this.getTags(context);

        // Operators
        const exactTag = availableTags.find(
            (t) => t.name.toLowerCase() === metaPart,
        );
        if (exactTag) {
            for (const op of ['=', '!=', '>', '<', '>=', '<=']) {
                list.push(
                    this.createSuggestion(
                        op,
                        op,
                        this.prefix + exactTag.name,
                        `Operator ${op}`,
                        'sym_o_calculate',
                        false,
                        false,
                    ),
                );
            }
        }

        // Keys - append = to value so selecting gives meta:description=
        for (const tag of availableTags) {
            if (
                tag.name.toLowerCase().includes(metaPart) &&
                tag.name.toLowerCase() !== metaPart
            ) {
                list.push(
                    this.createSuggestion(
                        tag.name,
                        tag.name + '=',
                        this.prefix,
                        `Metadata: ${tag.datatype}`,
                        'sym_o_label',
                        false,
                        false,
                    ),
                );
            }
        }

        // All keys if empty - append = to value
        if (metaPart === '') {
            for (const tag of availableTags.slice(0, 50)) {
                list.push(
                    this.createSuggestion(
                        tag.name,
                        tag.name + '=',
                        this.prefix,
                        `Metadata: ${tag.datatype}`,
                        'sym_o_label',
                        false,
                        false,
                    ),
                );
            }
        }

        return list;
    }
}

export class CompositeFilterProvider<T> implements SuggestionProvider<T> {
    constructor(private strategies: SuggestionProvider<T>[]) {}

    getSuggestions(context: SuggestionContext<T>): Suggestion[] {
        const results: Suggestion[] = [];
        for (const s of this.strategies) {
            results.push(...s.getSuggestions(context));
        }
        return results;
    }
}
