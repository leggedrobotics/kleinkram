import { KEYWORDS } from 'src/composables/use-filter-parser';
import { MissionFilterState } from 'src/composables/use-mission-file-filter';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

import CategoryFilterComponent from 'src/components/files/filter/components/category-filter.vue';

interface CategoryContext {
    availableCategories?: {
        name: string;
        uuid: string;
        description?: string;
    }[];
}

export class CategoryFilter extends BaseFilter<
    MissionFilterState,
    CategoryContext
> {
    constructor() {
        super(
            KEYWORDS.CATEGORY,
            'Category',
            'sym_o_category',
            CategoryFilterComponent,
        );
    }

    parse(
        tokenValue: string,
        state: MissionFilterState,
        context: CategoryContext,
    ): void {
        if (!tokenValue || !context.availableCategories) return;

        // Try to find by name (case-insensitive) or UUID
        const lower = tokenValue.toLowerCase();
        const category = context.availableCategories.find(
            (c) =>
                c.name.toLowerCase() === lower ||
                c.uuid.toLowerCase() === lower,
        );

        if (category && !state.categories.includes(category.uuid)) {
            state.categories.push(category.uuid);
        }
    }

    protected override getSuggestionItems(
        context: SuggestionContext<CategoryContext>,
    ): { name: string }[] {
        return context.data.availableCategories ?? [];
    }
}
