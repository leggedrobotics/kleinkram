import DateFilterComponent from 'src/components/files/filter/components/date-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { Suggestion } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class StartDateFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(
            KEYWORDS.START,
            'Start Date',
            'sym_o_calendar_today',
            DateFilterComponent,
        );
    }

    parse(tokenValue: string, state: FilterState): void {
        if (tokenValue) state.startDates = `${tokenValue} 00:00`;
    }

    override getSuggestions(): Suggestion[] {
        // Date filters don't provide autocomplete suggestions
        return [];
    }
}

export class EndDateFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(KEYWORDS.END, 'End Date', 'sym_o_calendar_today');
        // No UI, handled by StartDateFilter
    }
    parse(tokenValue: string, state: FilterState): void {
        if (tokenValue) state.endDates = `${tokenValue} 23:59`;
    }

    override getSuggestions(): Suggestion[] {
        return [];
    }
}
