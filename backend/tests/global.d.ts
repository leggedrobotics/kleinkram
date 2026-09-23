// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface GlobalThis {
        [key: string]: any;
    }

    var creator: any;
    var user: any;
    var externalUser: any;
    var admin: any;
    var userToken: string;
    var userResponse: any;
    var projectUuid: string;
    var missionUuid: string;
    var templateUuid: string;
    var metadataTypeUuid: string;
    var projectUuids: string[];
    var metadataTypeName: string;
}

export {};
