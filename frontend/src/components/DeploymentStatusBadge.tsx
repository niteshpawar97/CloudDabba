import { Badge } from './ui/Badge';
import { DeploymentStatus } from '../types/deployment';

const statusConfig: Record<DeploymentStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' }> = {
  QUEUED: { label: 'Queued', variant: 'default' },
  CLONING: { label: 'Cloning', variant: 'purple' },
  BUILDING: { label: 'Building', variant: 'warning' },
  DEPLOYING: { label: 'Deploying', variant: 'info' },
  LIVE: { label: 'Live', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  STOPPED: { label: 'Stopped', variant: 'default' },
};

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const config = statusConfig[status] || { label: status, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
