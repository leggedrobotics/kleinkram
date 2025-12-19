import ProjectFilterComponent from 'src/components/files/filter/components/project-filter.vue';
import { FilterState } from 'src/composables/use-file-filter';
import { FileSearchContextData } from 'src/composables/use-file-search';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

export class ProjectFilter extends BaseFilter<
    FilterState,
    FileSearchContextData
> {
    constructor() {
        super(
            KEYWORDS.PROJECT,
            'Project',
            'sym_o_folder',
            ProjectFilterComponent,
        );
    }

    parse(
        tokenValue: string,
        state: FilterState,
        context: FileSearchContextData,
    ): void {
        if (!tokenValue) return;

        if (context.projects.length === 0) {
            if (context.setProject) context.setProject(tokenValue);
        } else {
            const project = context.projects.find(
                (p) =>
                    p.name.toLowerCase() === tokenValue.toLowerCase() ||
                    p.uuid === tokenValue,
            );
            if (project && context.setProject) {
                context.setProject(project.uuid);
            }
        }
    }

    protected override getSuggestionItems(
        context: SuggestionContext<FileSearchContextData>,
    ): { name: string }[] {
        return context.data.projects;
    }
}
