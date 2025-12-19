import DatatypeFilterComponent from 'src/components/files/filter/components/datatype-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class DatatypeFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(
            KEYWORDS.DATATYPE,
            'Datatype',
            'sym_o_data_object',
            DatatypeFilterComponent,
        );
    }

    parse(tokenValue: string, state: FilterState): void {
        if (tokenValue) state.selectedDatatypes.push(tokenValue);
    }

    protected override getSuggestionItems(
        context: SuggestionContext<FileSearchContextData>,
    ): string[] {
        return context.data.datatypes;
    }
}
