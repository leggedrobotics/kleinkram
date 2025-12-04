import ActionEntity from '@backend-common/entities/action/action.entity';
import UserEntity from '@backend-common/entities/user/user.entity';
import { FileEventType } from '@kleinkram/shared';

export type AuditActionType = FileEventType;

export interface AuditContext {
    fileUuid?: string;
    filename?: string;
    missionUuid?: string;
    actor?: UserEntity;
    action?: ActionEntity;
    details?: Record<string, any>;
}

export type AuditContextExtractor = (arguments_: any[]) => AuditContext;
