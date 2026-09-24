/**
 * Where the data of a project lives. Everything but `ACTIVE` makes the
 * project read-only: its metadata stays browsable, but files can be neither
 * uploaded, downloaded, moved nor deleted, and no actions can run on it.
 */
export enum ProjectArchiveState {
    /** Data is in the hot object storage (S3), the project is fully usable. */
    ACTIVE = 'ACTIVE',
    /** Data is being packed and copied to the long term storage. */
    ARCHIVING = 'ARCHIVING',
    /** Data lives on the long term storage only. */
    ARCHIVED = 'ARCHIVED',
    /** Data is being recalled from the long term storage. */
    RESTORING = 'RESTORING',
}

/**
 * Fine grained progress of one archive (and its later restores).
 *
 * Archiving: QUEUED → PACKING → VERIFYING → AWAITING_TAPE → PURGING → ARCHIVED
 * Restoring: ARCHIVED → RECALLING → UNPACKING → RESTORED
 *
 * A restored archive stays on the long term storage. Archiving the project
 * again while its files are unchanged reuses it instead of writing a copy.
 */
export enum ProjectArchiveJobState {
    QUEUED = 'QUEUED',
    /** Streaming the files from S3 into tar parts on the long term storage. */
    PACKING = 'PACKING',
    /** Re-reading the parts and comparing their checksums. */
    VERIFYING = 'VERIFYING',
    /**
     * Waiting for the long term storage to seal the parts (the delay action
     * timer of ETH LTS, 1h by default) and move them to tape. The S3 copy is
     * kept until then.
     */
    AWAITING_TAPE = 'AWAITING_TAPE',
    /** Removing the now redundant copies from S3. */
    PURGING = 'PURGING',
    ARCHIVED = 'ARCHIVED',
    /** Copying the parts from tape to a local staging disk. */
    RECALLING = 'RECALLING',
    /** Extracting the parts and uploading the files back to S3. */
    UNPACKING = 'UNPACKING',
    RESTORED = 'RESTORED',
    FAILED = 'FAILED',
}
