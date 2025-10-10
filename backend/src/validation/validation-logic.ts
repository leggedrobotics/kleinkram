export const MISSION_NAME_REGEX = /^[\w\-_]{3,50}$/;

export const PROJECT_NAME_REGEX = /^[\w\-_]{3,50}$/;

export const FILE_NAME_REGEX = /^[\w\-.()]{3,50}.(bag|mcap|db3|yaml|svo2|tum)$/;

export const NON_UUID_REGEX =
    /^(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$)/;
