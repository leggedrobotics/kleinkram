import FileTypeFilterComponent from 'src/components/files/filter/components/file-type-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class FileTypeFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(
            KEYWORDS.FILETYPE,
            'File Type',
            'sym_o_description',
            FileTypeFilterComponent,
        );
    }

    parse(tokenValue: string, state: FilterState): void {
        if (tokenValue && state.fileTypeFilter) {
            const lower = tokenValue.toLowerCase();
            const ft = state.fileTypeFilter.find(
                (f) => f.name.toLowerCase() === lower,
            );
            if (ft) ft.value = true;
        }
    }

    protected override getSuggestionItems(
        context: SuggestionContext<FileSearchContextData>,
    ): string[] {
        return context.data.fileTypes;
    }
}
