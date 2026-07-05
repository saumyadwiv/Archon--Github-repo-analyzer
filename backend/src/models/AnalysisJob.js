const mongoose = require('mongoose');

const { Schema } = mongoose;

const STAGES = [
  'queued',
  'cloning',
  'discovering_files',
  'parsing_ast',
  'building_graph',
  'detecting_cycles',
  'computing_complexity',
  'scoring_health',
  'completed',
  'failed',
];

const analysisJobSchema = new Schema(
  {
    repository: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    bullJobId: { type: String, index: true }, // BullMQ job id for cross-reference

    status: {
      type: String,
      enum: ['queued', 'active', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    stage: { type: String, enum: STAGES, default: 'queued' },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    progressMessage: { type: String, default: '' },

    filesDiscovered: { type: Number, default: 0 },
    filesParsed: { type: Number, default: 0 },
    filesFailed: { type: Number, default: 0 },

    error: {
      message: { type: String },
      stack: { type: String },
    },

    startedAt: { type: Date },
    finishedAt: { type: Date },
    durationMs: { type: Number },
  },
  { timestamps: true }
);

analysisJobSchema.statics.STAGES = STAGES;

module.exports = mongoose.model('AnalysisJob', analysisJobSchema);
