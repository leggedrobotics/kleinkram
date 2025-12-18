import {
    Suggestion,
    SuggestionContext,
    SuggestionProvider,
} from '../suggestion-types';

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
