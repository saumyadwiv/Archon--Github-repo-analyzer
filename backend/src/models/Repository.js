const mongoose = require('mongoose');

const { Schema } = mongoose;

const repositorySchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    githubUrl: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true }, // e.g. "facebook/react"
    name: { type: String, required: true },
    ownerLogin: { type: String, required: true },

    defaultBranch: { type: String, default: 'main' },
    isPrivate: { type: Boolean, default: false },
    description: { type: String },
    starCount: { type: Number, default: 0 },
    primaryLanguage: { type: String },

    localClonePath: { type: String }, // ephemeral path during analysis, cleared after
    lastCommitSha: { type: String },

    status: {
      type: String,
      enum: ['pending', 'cloning', 'analyzing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },

    latestAnalysisJob: { type: Schema.Types.ObjectId, ref: 'AnalysisJob' },
    latestMetricsSnapshot: { type: Schema.Types.ObjectId, ref: 'MetricsSnapshot' },

    analysisCount: { type: Number, default: 0 },
    lastAnalyzedAt: { type: Date },
  },
  { timestamps: true }
);

repositorySchema.index({ owner: 1, fullName: 1 }, { unique: true });

module.exports = mongoose.model('Repository', repositorySchema);
