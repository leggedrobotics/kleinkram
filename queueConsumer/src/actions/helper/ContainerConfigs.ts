// As we are streaming the logs,
// we need to keep the logs at a reasonable size.
export const LogConfig = {
    Type: 'json-file',
    Config: {
        'max-size': '10m',
        'max-file': '1',
    },
};

// For security reasons, we drop all default capabilities
// and only add the ones we really need.
export const CapDrop = [
    'CHOWN',
    'DAC_OVERRIDE',
    'FSETID',
    'FOWNER',
    'MKNOD',
    'NET_RAW',
    'SETGID',
    'SETUID',
    'SETFCAP',
    'SETPCAP',
    'NET_BIND_SERVICE',
    'SYS_CHROOT',
    'KILL',
    'AUDIT_WRITE',
];

// limits the number of processes the container can create
// this helps to prevent fork bombs / bugs in the container
// and helps to keep the base system stable even if the container is compromised
export const PidsLimit = 256;

// we don't want to allow the container to escalate privileges
export const SecurityOpt = ['no-new-privileges'];

// TODO: we should not use host network mode
//  as it can be a security risk! We should use a bridge network instead.
export const NetworkMode = 'host';
