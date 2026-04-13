// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class FileDownloadDto {
    name!: string;
    size!: number;
    downloaded!: number;
    speed!: number;
    canceled!: boolean;
    fileUUID!: string;
}
