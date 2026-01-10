import {
    Suggestion,
    SuggestionContext,
} from 'src/services/suggestions/suggestion-types';
import { Component } from 'vue';

export interface Filter<TState, TContext> {
    readonly key: string;
    readonly label: string;
    readonly icon: string;

    // Parsing Logic
    parse(tokenValue: string, state: TState, context: TContext): void;

    // Suggestion Logic - matches SuggestionProvider interface
    getSuggestions(context: SuggestionContext<TContext>): Suggestion[];

    // Advanced UI Component (optional)
    readonly advancedComponent?: Component | undefined;
}
