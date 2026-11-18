export interface AccessGroupConfig {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    emails: { email: string; access_groups: string[] }[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    access_groups: { name: string; uuid: string; rights: number }[];
    /**
     * Whether users whose email is not on one of the domains in `emails`
     * can sign in. Defaults to `true`. With `false`, only users with a
     * verified email on one of these domains can sign in or stay signed in.
     */
    // eslint-disable-next-line @typescript-eslint/naming-convention
    allow_external_users?: boolean;
}
