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
  
  // Auto-deletion after 1 month as requested
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  const updatedLogs = [newLog, ...logs]
    .filter(log => new Date(log.timestamp) > oneMonthAgo)
    .slice(0, 1000); // Also limit total count

  localStorage.setItem('microfox_audit_logs', JSON.stringify(updatedLogs));
};
