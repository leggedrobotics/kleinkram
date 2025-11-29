import ActionEntity from '../entities/action/action.entity';
import UserEntity from '../entities/user/user.entity';
import { FileEventType } from '../frontend_shared/enum';

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
