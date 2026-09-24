/**
 * Where the data of a project lives. Everything but `ACTIVE` makes the
 * project read-only: its metadata stays browsable, but files can be neither
 * uploaded, downloaded, moved nor deleted, and no actions can run on it.
 */
export enum ProjectArchiveState {
    /** Data is in the hot object storage (S3), the project is fully usable. */
    ACTIVE = 'ACTIVE',
    /** Data is being packed and copied to the archive storage. */
    ARCHIVING = 'ARCHIVING',
    /** Data lives on the archive storage only. */
    ARCHIVED = 'ARCHIVED',
    /** Data is being recalled from the archive storage. */
    RESTORING = 'RESTORING',
}

/**
 * Fine grained progress of one archive (and its later restores).
 *
 * Archiving: QUEUED → PACKING → VERIFYING → AWAITING_SEAL → PURGING → ARCHIVED
 * Restoring: ARCHIVED → RECALLING → UNPACKING → RESTORED
 *
 * A restored archive stays on the archive storage. Archiving the project
 * again while its files are unchanged reuses it instead of writing a copy.
 */
export enum ProjectArchiveJobState {
    QUEUED = 'QUEUED',
    /** Streaming the files from S3 into tar parts on the archive storage. */
    PACKING = 'PACKING',
    /** Re-reading the parts and comparing their checksums. */
    VERIFYING = 'VERIFYING',
    /**
     * Waiting for the archive storage to seal the parts, i.e. make them
     * read-only for good (tape-backed storage such as ETH LTS does so after a
     * delay, then moves them to tape). The S3 copy is
     * kept until then.
     */
    AWAITING_SEAL = 'AWAITING_SEAL',
    /** Removing the now redundant copies from S3. */
    PURGING = 'PURGING',
    ARCHIVED = 'ARCHIVED',
    /** Copying the parts from the archive storage to a local staging disk. */
    RECALLING = 'RECALLING',
    /** Extracting the parts and uploading the files back to S3. */
    UNPACKING = 'UNPACKING',
    RESTORED = 'RESTORED',
    FAILED = 'FAILED',
}
