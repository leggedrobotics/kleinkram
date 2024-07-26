import { IsUrl, IsUUID } from 'class-validator';

export class DriveCreate {
    @IsUUID()
    missionUUID: string;

    @IsUrl()
    driveURL: string;
}
