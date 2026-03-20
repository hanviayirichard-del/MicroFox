import { AuditLog } from '../types';

export const recordAuditLog = (
  action: AuditLog['action'],
  module: string,
  details: string,
  status: AuditLog['status'] = 'SUCCES',
  userOverride?: any
) => {
  const currentUser = userOverride || JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
  if (!currentUser) return;

  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    userId: currentUser.id,
    userName: currentUser.identifiant,
    userRole: currentUser.role,
    action,
    module,
    details,
    status
  };

  const savedLogs = localStorage.getItem('microfox_audit_logs');
  const logs: AuditLog[] = savedLogs ? JSON.parse(savedLogs) : [];
  
  // Keep only the last 5000 logs to avoid localStorage overflow
  const updatedLogs = [newLog, ...logs].slice(0, 5000);
  localStorage.setItem('microfox_audit_logs', JSON.stringify(updatedLogs));
  
  // Also mark for sync if needed
  localStorage.setItem('microfox_pending_sync', 'true');
};
