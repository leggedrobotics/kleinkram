import {
    Suggestion,
    SuggestionConfig,
    SuggestionContext,
    SuggestionProvider,
} from '../suggestion-types';

export abstract class BaseStrategy<T> implements SuggestionProvider<T> {
    abstract getSuggestions(context: SuggestionContext<T>): Suggestion[];

    protected getLastWord(input: string): string {
        const lastWordRegex =
            /([a-zA-Z0-9_-]+:"[^"]*|[a-zA-Z0-9_:=><!\\/.\-@#~"]+)$/;
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
