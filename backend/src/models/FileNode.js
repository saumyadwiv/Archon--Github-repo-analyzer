const mongoose = require('mongoose');

const { Schema } = mongoose;

const functionMetricSchema = new Schema(
  {
    name: { type: String, required: true },
    startLine: { type: Number },
    endLine: { type: Number },
    cyclomaticComplexity: { type: Number, default: 1 },
    paramCount: { type: Number, default: 0 },
    isAsync: { type: Boolean, default: false },
    isExported: { type: Boolean, default: false },
  },
  { _id: false }
);

const fileNodeSchema = new Schema(
  {
    repository: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
    analysisJob: { type: Schema.Types.ObjectId, ref: 'AnalysisJob', required: true, index: true },

    filePath: { type: String, required: true }, // relative path from repo root
    fileName: { type: String, required: true },
    extension: { type: String, enum: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py'], required: true },
    language: { type: String, enum: ['javascript', 'typescript', 'python'], required: true },

    linesOfCode: { type: Number, default: 0 },
    sizeBytes: { type: Number, default: 0 },

    imports: [
      {
        source: { type: String }, // module specifier as written, e.g. "./utils/foo"
        resolvedPath: { type: String }, // resolved relative path within repo, null if external
        isExternal: { type: Boolean, default: false }, // npm package / stdlib
        importedNames: [{ type: String }], // named imports
        isDefaultImport: { type: Boolean, default: false },
        isNamespaceImport: { type: Boolean, default: false },
      },
    ],

    exports: [
      {
        name: { type: String },
        type: { type: String, enum: ['function', 'class', 'variable', 'default', 'other'], default: 'other' },
      },
    ],

    functions: [functionMetricSchema],

    fileComplexity: { type: Number, default: 0 }, // sum of function complexities
    averageComplexity: { type: Number, default: 0 },
    maxComplexity: { type: Number, default: 0 },

    isEntryPoint: { type: Boolean, default: false },
    inCycle: { type: Boolean, default: false }, // set true if part of a circular dependency

    parseError: { type: String }, // populated if AST parsing failed for this file
  },
  { timestamps: true }
);

fileNodeSchema.index({ repository: 1, analysisJob: 1, filePath: 1 }, { unique: true });

module.exports = mongoose.model('FileNode', fileNodeSchema);
