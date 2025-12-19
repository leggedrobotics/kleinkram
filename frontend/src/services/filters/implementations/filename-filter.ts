import { MissionFilterState } from 'src/composables/use-mission-file-filter';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

interface FilenameContext {
    filenames: string[];
}

export class FilenameFilter extends BaseFilter<
    MissionFilterState,
    FilenameContext
> {
    constructor() {
        super('filename:', 'Filename', 'sym_o_description');
    }

    parse(tokenValue: string, state: MissionFilterState): void {
        if (tokenValue) {
            state.filter = tokenValue;
        }
    }

    protected override getSuggestionItems(
        context: SuggestionContext<FilenameContext>,
    ): string[] {
        return context.data.filenames;
    }
}
