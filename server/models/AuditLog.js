const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'LOAN_APPROVED',
      'LOAN_REJECTED',
      'LOAN_AUTO_APPROVED',
      'LOAN_SPECIAL_APPROVED',
      'LOAN_DISBURSED',
      'USER_CREATED',
      'USER_UPDATED',
      'USER_DELETED',
      'USER_ACTIVATED',
      'USER_DEACTIVATED',
      'SETTINGS_UPDATED',
      'SYSTEM_BACKUP',
      'SYSTEM_MAINTENANCE',
      'ADMIN_ACCESS',
      'FAILED_LOGIN',
      'PASSWORD_CHANGE',
      'PERMISSION_CHANGE',
    ],
  },
  resource: {
    type: String,
    required: true,
    enum: ['user', 'loan', 'system', 'settings', 'admin', 'auth'],
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false, // Optional for system-wide actions
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Store additional context
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  success: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Index for better query performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);