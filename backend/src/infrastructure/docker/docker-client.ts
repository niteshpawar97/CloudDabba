import Docker from 'dockerode';
import { config } from '../../shared/config/app.config';

const isWindows = process.platform === 'win32';
const socketPath = isWindows ? '//./pipe/dockerDesktopLinuxEngine' : config.docker.socketPath;

const docker = new Docker({ socketPath });

export default docker;
