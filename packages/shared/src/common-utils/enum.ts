export enum QueueState {
    'AWAITING_UPLOAD' = 0,
    'AWAITING_PROCESSING' = 10,
    'PROCESSING' = 20,
    'DOWNLOADING' = 21,
    'CONVERTING_AND_EXTRACTING_TOPICS' = 22,
    'UPLOADING' = 23,
    'COMPLETED' = 30,
    'ERROR' = 40,
    'CORRUPTED' = 41,
    'CANCELED' = 42,
    'UNSUPPORTED_FILE_TYPE' = 43,
    'FILE_ALREADY_EXISTS' = 44,
}

export enum FileOrigin {
    GOOGLE_DRIVE = 'GOOGLE_DRIVE',
    UPLOAD = 'UPLOAD',
    CONVERTED = 'CONVERTED',
    UNKNOWN = 'UNKNOWN',
}

export enum FileLocation {
    DRIVE = 'DRIVE',
    MINIO = 'MINIO',
}

export enum UserRole {
    /**
     * A user with full access to all resources.
     * This role is reserved for system administrators and
     * should not be assigned in regular use.
     *
     */
    ADMIN = 'ADMIN',

    /**
     * A regular user with no special permissions.
     * This is the default role for new users.
     *
     */
    USER = 'USER',
}

export enum AccessGroupType {
    /**
     * A group that is created by the system. Users are added
     * to this group automatically based on their email domain.
     *
     * Example: All users with an email ending in `@example.com`
     * are automatically added to the `AFFILIATION` group with
     * the name `example.com`.
     *
     * Affiliation groups are created by the system and cannot
     * be deleted or modified. They may be granted some global
     * permissions (e.g., project create permission).
     *
     */
    AFFILIATION = 'AFFILIATION',

    /**
     * A group that is created by the system. Every user has
     * their own primary group. Primary groups are created
     * by the system and cannot be deleted or modified.
     *
     * Primary groups are used to store permissions that are
     * specific to a single user.
     *
     */
    PRIMARY = 'PRIMARY',

    /**
     * A group created via API or the UI. These groups can be
     * deleted or modified by the user who created them.
     *
     */
    CUSTOM = 'CUSTOM',
}

export enum ActionState {
    PENDING = 'PENDING',
    STARTING = 'STARTING',
    PROCESSING = 'PROCESSING',
    STOPPING = 'STOPPING',
    DONE = 'DONE',
    FAILED = 'FAILED',
    UNPROCESSABLE = 'UNPROCESSABLE',
}

export enum KeyTypes {
    ACTION = 'ACTION',
}

export enum CookieNames {
    AUTH_TOKEN = 'authtoken',
    REFRESH_TOKEN = 'refreshtoken',
    CLI_KEY = 'clikey',
}

export enum FileType {
    BAG = 'BAG',
    MCAP = 'MCAP',
    YAML = 'YAML',
    SVO2 = 'SVO2',
    TUM = 'TUM',
    DB3 = 'DB3',
    ALL = 'ALL',
}

export enum Providers {
    GOOGLE = 'google',
    GITHUB = 'github',
    FakeOAuth = 'fake-oauth', // for local dev only
}

export enum DataType {
    STRING = 'STRING',
    NUMBER = 'NUMBER',
    BOOLEAN = 'BOOLEAN',
    DATE = 'DATE',
    LOCATION = 'LOCATION',
    LINK = 'LINK',
    ANY = 'ANY',
}

export enum ArtifactState {
    AWAITING_ACTION = 10,
    UPLOADING = 20,
    UPLOADED = 30,
    ERROR = 40,
}

export enum FileState {
    OK = 'OK',
    CORRUPTED = 'CORRUPTED',
    UPLOADING = 'UPLOADING',
    ERROR = 'ERROR',
    CONVERTING = 'CONVERTING',
    CONVERSION_ERROR = 'CONVERSION_ERROR',
    LOST = 'LOST',
    FOUND = 'FOUND',
}

export enum HealthStatus {
    HEALTHY = 'Healthy',
    UNHEALTHY = 'Unhealthy',
    UPLOADING = 'Uploading',
}

export enum AccessGroupRights {
    READ = 0,
    CREATE = 10,
    WRITE = 20,
    DELETE = 30,

    _ADMIN = 100,
}

export enum FileEventType {
    // Lifecycle
    CREATED = 'CREATED',
    DELETED = 'DELETED',

    // Ingestion
    UPLOAD_STARTED = 'UPLOAD_STARTED',
    UPLOAD_COMPLETED = 'UPLOAD_COMPLETED',
    TOPICS_EXTRACTED = 'TOPICS_EXTRACTED',
    FILE_CONVERTED = 'FILE_CONVERTED',
    FILE_CONVERTED_FROM = 'FILE_CONVERTED_FROM',
    FOXGLOVE_URL_GENERATED = 'FOXGLOVE_URL_GENERATED',

    // User Actions
    DOWNLOADED = 'DOWNLOADED',
    RENAMED = 'RENAMED',
    MOVED = 'MOVED',
}

export enum FileSource {
    ACTION = 'Action',
    CLI = 'CLI',
    WEB_INTERFACE = 'Web Interface',
}

export enum ImageSource {
    PULLED = 'pulled',
    CACHED = 'cached',
    LOCALLY_BUILT = 'locally_built',
    LOCALLY_BUILT_LOCAL_ONLY = 'locally_built_local_only',
}

export enum LogType {
    STDOUT = 'stdout',
    STDERR = 'stderr',
}
