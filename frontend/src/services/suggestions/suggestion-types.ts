export interface Suggestion {
    label: string;
    value: string;
    prefix: string;
    description: string;
    icon: string;
    appendSpace?: boolean;
    disabled?: boolean;
}

export interface SuggestionContext<T = unknown> {
    input: string;
    // Additional context data (e.g. loaded projects, current permissions)
    // can be passed here, specific to the implementer.
    data: T;
}

export interface SuggestionProvider<T = unknown> {
    getSuggestions(context: SuggestionContext<T>): Suggestion[];
}
