export interface AccessGroupConfig {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    emails: { email: string; access_groups: string[] }[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    access_groups: { name: string; uuid: string; rights: number }[];
}
