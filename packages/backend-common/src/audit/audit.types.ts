import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { FileEventType } from '@kleinkram/shared';

export type AuditActionType = FileEventType;

export interface AuditContext {
    fileUuid?: string;
    filename?: string;
    missionUuid?: string;
    actor?: UserEntity;
    action?: ActionEntity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: Record<string, any>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuditContextExtractor = (arguments_: any[]) => AuditContext;
