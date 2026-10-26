import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireAdmin } from '../../core/middleware/admin.middleware';
import { audit, userTarget } from '../../core/middleware/audit.middleware';
import { BackupController } from '../controllers/backup.controller';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/stats', AdminController.getStats);
router.get('/activity', AdminController.getActivity);

// Users
router.get('/users', AdminController.listUsers);
router.put('/users/:id/approval', audit('user.approval', (r) => ({ ...userTarget(r), meta: { approved: r.body?.approved !== false } })), AdminController.setUserApproval);
router.post('/users/:id/impersonate', audit('user.impersonate', userTarget), AdminController.impersonateUser);
router.post('/users/:id/reset-link', audit('user.password_reset_link', userTarget), AdminController.createResetLink);
router.put('/users/:id/role', audit('user.role_change', (r) => ({ ...userTarget(r), meta: { role: r.body?.role } })), AdminController.updateUserRole);
router.delete('/users/:id', audit('user.delete', userTarget), AdminController.deleteUser);

// Projects & Deployments
router.get('/projects', AdminController.listAllProjects);
router.get('/deployments', AdminController.listAllDeployments);

// Docker Containers
router.get('/containers', AdminController.listContainers);
router.post('/containers/:id/stop', audit('container.stop', (r) => ({ target: { type: 'container', id: r.params.id as string } })), AdminController.stopContainer);
router.delete('/containers/:id', audit('container.remove', (r) => ({ target: { type: 'container', id: r.params.id as string } })), AdminController.removeContainer);
router.post('/containers/cleanup', audit('container.cleanup'), AdminController.cleanupContainers);

// Docker Images
router.get('/images', AdminController.listImages);
router.delete('/images/:id', audit('image.delete', (r) => ({ target: { type: 'image', id: r.params.id as string } })), AdminController.deleteImage);
router.post('/images/cleanup', audit('image.cleanup'), AdminController.cleanupImages);

// Docker system maintenance (broader than the *.managed cleanups above)
router.post('/docker/prune/containers', audit('docker.prune_containers'), AdminController.pruneStoppedContainers);
router.post('/docker/prune/images', audit('docker.prune_images'), AdminController.pruneUnusedImages);
router.post('/docker/prune/system', audit('docker.prune_system'), AdminController.pruneSystem);

// Docker / container health
router.get('/health', AdminController.getHealth);

// Notifications
router.get('/notifications', AdminController.getNotificationSettings);
router.put('/notifications', audit('settings.notifications'), AdminController.updateNotificationSettings);
router.post('/notifications/test', AdminController.testNotification);

// Resource overview
router.get('/resources', AdminController.getResourceOverview);

// Automatic storage management
router.get('/storage/status', AdminController.getStorageStatus);
router.get('/storage/history', AdminController.getStorageHistory);
router.post('/storage/safe-cleanup', audit('storage.safe_cleanup'), AdminController.safeStorageCleanup);

// Settings
router.get('/settings', AdminController.getSettings);
router.patch('/settings', audit('settings.update', (r) => ({ meta: { fields: Object.keys(r.body || {}) } })), AdminController.updateSettings);
router.post('/restart', audit('server.restart'), AdminController.restartServer);

// Diagnostics
router.get('/server-info', AdminController.getServerInfo);
router.post('/test-dns', AdminController.testDns);
router.get('/ssl-status', AdminController.getSslStatus);
router.get('/port-range-status', AdminController.getPortRangeStatus);
router.post('/change-domain', audit('settings.change_domain'), AdminController.changeDomain);
router.post('/install-ssl', audit('settings.install_ssl'), AdminController.installSsl);

// Cloudflare wildcard SSL
router.get('/cloudflare/status', AdminController.getCloudflareStatus);
router.post('/cloudflare/token', audit('settings.cloudflare_token_set'), AdminController.saveCloudflareToken);
router.delete('/cloudflare/token', audit('settings.cloudflare_token_remove'), AdminController.removeCloudflareToken);
router.post('/install-wildcard-ssl', AdminController.installWildcardSsl);

// Changelog
router.get('/changelog', AdminController.getChangelog);

// Databases
router.get('/databases', AdminController.listDatabases);
router.delete('/databases/:id/postgres', audit('database.admin_delete', (r) => ({ target: { type: 'project', id: r.params.id as string }, meta: { engine: 'postgres' } })), AdminController.adminDeletePostgres);
router.delete('/databases/:id/mariadb', audit('database.admin_delete', (r) => ({ target: { type: 'project', id: r.params.id as string }, meta: { engine: 'mariadb' } })), AdminController.adminDeleteMariadb);
router.delete('/databases/:id/redis', audit('database.admin_delete', (r) => ({ target: { type: 'project', id: r.params.id as string }, meta: { engine: 'redis' } })), AdminController.adminDeleteRedis);

// Audit log
router.get('/audit', AdminController.listAudit);

// Platform database backups
router.get('/backups', BackupController.listPlatform);
router.post('/backups/platform', audit('backup.platform_create'), BackupController.createPlatform);
router.get('/backups/:backupId/download', audit('backup.platform_download', (r) => ({ target: { type: 'backup', id: r.params.backupId as string } })), BackupController.downloadPlatform);
router.delete('/backups/:backupId', audit('backup.platform_delete', (r) => ({ target: { type: 'backup', id: r.params.backupId as string } })), BackupController.removePlatform);

export default router;
