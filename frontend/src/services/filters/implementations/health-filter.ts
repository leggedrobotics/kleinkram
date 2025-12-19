import { HealthStatus } from '@kleinkram/shared';
import { KEYWORDS } from 'src/composables/use-filter-parser';
import { MissionFilterState } from 'src/composables/use-mission-file-filter';
import { SuggestionContext } from 'src/services/suggestions/suggestion-types';
import { BaseFilter } from '../base-filter';

import HealthFilterComponent from 'src/components/files/filter/components/health-filter.vue';

export class HealthFilter extends BaseFilter<MissionFilterState, unknown> {
    constructor() {
        super(
            KEYWORDS.HEALTH,
            'File Health',
            'sym_o_health_and_safety',
            HealthFilterComponent,
        );
    }

    parse(tokenValue: string, state: MissionFilterState): void {
        if (!tokenValue) return;
        const upper = tokenValue.toUpperCase();
        if (
            upper === (HealthStatus.HEALTHY as string).toUpperCase() ||
            upper === (HealthStatus.UPLOADING as string).toUpperCase() ||
            upper === (HealthStatus.UNHEALTHY as string).toUpperCase()
        ) {
            // Find the enum value that matches
            const match = Object.values(HealthStatus).find(
                (v) => v.toUpperCase() === upper,
            );
            if (match) {
                state.health = match;
            }
        }
    }

    protected override getSuggestionItems(
        _context: SuggestionContext,
    ): string[] {
        return [
            HealthStatus.HEALTHY,
            HealthStatus.UPLOADING,
            HealthStatus.UNHEALTHY,
        ];
    }
}
