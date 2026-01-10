import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class MissionFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(KEYWORDS.MISSION, 'Mission', 'sym_o_flag');
        // No UI component - relies on ProjectFilter's ScopeSelector
    }

    parse(
        tokenValue: string,
        state: FilterState,
        context: FileSearchContextData,
    ): void {
        if (!tokenValue) return;

        if (context.missions.length === 0) {
            if (context.setMission) context.setMission(tokenValue);
        } else {
            const mission = context.missions.find(
                (m) =>
                    m.name.toLowerCase() === tokenValue.toLowerCase() ||
                    m.uuid === tokenValue,
            );
            if (mission && context.setMission) {
                context.setMission(mission.uuid);
            }
        }
    }

    protected override getSuggestionItems(
        context: SuggestionContext<FileSearchContextData>,
    ): { name: string }[] {
        if (!context.data.hasProjectSelected) return [];
        return context.data.missions;
    }
}
