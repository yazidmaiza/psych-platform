const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    targetType: { type: String, default: '' },
    targetId: { type: String, default: '' },
    outcome: { type: String, enum: ['success', 'failure'], required: true, index: true },
    severity: {
      type: String,
      enum: ['debug', 'info', 'warn', 'error', 'security'],
      default: 'info',
      index: true
    },
    message: { type: String, default: '' },
    requestIp: { type: String, default: '' },
    requestUserAgent: { type: String, default: '' },
    correlationId: { type: String, default: '', index: true },
    requestMethod: { type: String, default: '' },
    requestPath: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Query performance indexes (UC-11/UC-12)
auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index({ actorUserId: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditEventSchema.index({ outcome: 1, createdAt: -1 });
auditEventSchema.index({ severity: 1, createdAt: -1 });

// Best-effort immutability: prevent app-level mutation via Mongoose update/delete methods.
// (Direct DB access can still modify; enforce at DB/policy level if required.)
const denyMutation = function () {
  const err = new Error('Audit events are append-only');
  err.status = 403;
  throw err;
};
auditEventSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], denyMutation);

module.exports = mongoose.model('AuditEvent', auditEventSchema);
