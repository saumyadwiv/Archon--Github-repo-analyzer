const mongoose = require('mongoose');

const { Schema } = mongoose;

const dependencyEdgeSchema = new Schema(
  {
    repository: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    analysisJob: { type: Schema.Types.ObjectId, ref: 'AnalysisJob', required: true, index: true },

    source: { type: Schema.Types.ObjectId, ref: 'FileNode', required: true, index: true }, // importer
    target: { type: Schema.Types.ObjectId, ref: 'FileNode', required: true, index: true }, // imported

    sourcePath: { type: String, required: true },
    targetPath: { type: String, required: true },

    importedNames: [{ type: String }],

    isPartOfCycle: { type: Boolean, default: false },
    cycleId: { type: String }, // groups edges that belong to the same detected cycle
  },
  { timestamps: true }
);

dependencyEdgeSchema.index({ analysisJob: 1, source: 1, target: 1 }, { unique: true });

module.exports = mongoose.model('DependencyEdge', dependencyEdgeSchema);
