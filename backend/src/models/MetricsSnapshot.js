const mongoose = require('mongoose');

const { Schema } = mongoose;

const metricsSnapshotSchema = new Schema(
  {
    repository: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    analysisJob: { type: Schema.Types.ObjectId, ref: 'AnalysisJob', required: true, unique: true },

    totalFiles: { type: Number, default: 0 },
    totalLinesOfCode: { type: Number, default: 0 },
    totalFunctions: { type: Number, default: 0 },

    averageComplexity: { type: Number, default: 0 },
    maxComplexity: { type: Number, default: 0 },
    highComplexityFileCount: { type: Number, default: 0 }, // files with avg complexity > threshold

    totalDependencyEdges: { type: Number, default: 0 },
    circularDependencyCount: { type: Number, default: 0 },
    filesInCycles: { type: Number, default: 0 },

    languageBreakdown: {
      type: Map,
      of: Number, // language -> file count
      default: {},
    },

    healthScore: { type: Number, min: 0, max: 100, required: true },
    healthGrade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'], required: true },

    scoreBreakdown: {
      complexityScore: { type: Number, default: 0 }, // contribution out of 100
      cycleScore: { type: Number, default: 0 },
      sizeScore: { type: Number, default: 0 },
      structureScore: { type: Number, default: 0 },
    },

    topComplexFiles: [
      {
        filePath: { type: String },
        complexity: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('MetricsSnapshot', metricsSnapshotSchema);
