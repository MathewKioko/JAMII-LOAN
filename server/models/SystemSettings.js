const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Can store strings, numbers, booleans, objects
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['general', 'loans', 'security', 'notifications', 'system'],
    default: 'general',
  },
  isEditable: {
    type: Boolean,
    default: true,
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Index for better query performance
systemSettingsSchema.index({ key: 1 });
systemSettingsSchema.index({ category: 1 });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);