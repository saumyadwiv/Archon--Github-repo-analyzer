const fs = require('fs-extra');
const { Repository, AnalysisJob, FileNode, DependencyEdge, MetricsSnapshot } = require('../models');
const { cloneRepository, cleanupClone } = require('./gitService');
const { discoverFiles } = require('./fileDiscoveryService');
const { parseJavaScriptFile } = require('./astParserService');
const { parsePythonFile } = require('./pythonParserService');
const { buildDependencyEdges } = require('./dependencyGraphService');
const { detectCircularDependencies } = require('./cycleDetectionService');
const { computeHealthScore } = require('./healthScoreService');
const { reportProgress, reportCompleted, reportFailed } = require('./progressService');
const logger = require('../config/logger');

const PROGRESS_UPDATE_EVERY_N_FILES = 15;

/**
 * Runs the full analysis pipeline for a given AnalysisJob. Called by the
 * BullMQ worker processor. Mutates AnalysisJob/Repository/FileNode/
 * DependencyEdge/MetricsSnapshot collections and reports live progress.
 */
async function runAnalysisJob(analysisJobId) {
  const job = await AnalysisJob.findById(analysisJobId);
  if (!job) throw new Error(`AnalysisJob ${analysisJobId} not found`);

  const repository = await Repository.findById(job.repository);
  if (!repository) throw new Error(`Repository ${job.repository} not found`);

  const repoId = repository._id.toString();
  const startedAt = Date.now();
  let localPath;

  try {
    await AnalysisJob.findByIdAndUpdate(job._id, { $set: { status: 'active', startedAt: new Date() } });
    await Repository.findByIdAndUpdate(repository._id, { $set: { status: 'cloning' } });

    // --- Stage 1: Clone ---
    await reportProgress(job._id, repoId, {
      stage: 'cloning',
      progressPercent: 5,
      progressMessage: `Cloning ${repository.fullName}...`,
    });

    const cloneResult = await cloneRepository(repository.githubUrl, job._id, {
      accessToken: undefined, // wired to user.githubAccessToken by the route layer if needed
    });
    localPath = cloneResult.localPath;

    await Repository.findByIdAndUpdate(repository._id, {
      $set: {
        status: 'analyzing',
        localClonePath: localPath,
        lastCommitSha: cloneResult.lastCommitSha,
        defaultBranch: cloneResult.defaultBranch || repository.defaultBranch,
      },
    });

    // --- Stage 2: Discover files ---
    await reportProgress(job._id, repoId, {
      stage: 'discovering_files',
      progressPercent: 15,
      progressMessage: 'Discovering source files...',
    });

    const discovered = await discoverFiles(localPath);
    await AnalysisJob.findByIdAndUpdate(job._id, { $set: { filesDiscovered: discovered.length } });

    if (discovered.length === 0) {
      throw new Error('No analyzable JS/TS/Python files found in this repository');
    }

    // --- Stage 3: Parse AST for every file ---
    await reportProgress(job._id, repoId, {
      stage: 'parsing_ast',
      progressPercent: 25,
      progressMessage: `Parsing ${discovered.length} files...`,
    });

    const fileNodeDocs = [];
    let filesParsed = 0;
    let filesFailed = 0;

    for (const file of discovered) {
      const doc = await parseOneFile(file, repository._id, job._id);
      fileNodeDocs.push(doc);
      if (doc.parseError) filesFailed += 1;
      else filesParsed += 1;

      if (filesParsed % PROGRESS_UPDATE_EVERY_N_FILES === 0) {
        const pct = 25 + Math.round((35 * filesParsed) / discovered.length);
        await reportProgress(job._id, repoId, {
          stage: 'parsing_ast',
          progressPercent: Math.min(pct, 60),
          progressMessage: `Parsed ${filesParsed}/${discovered.length} files...`,
          extra: { filesParsed, filesFailed },
        });
      }
    }

    await AnalysisJob.findByIdAndUpdate(job._id, { $set: { filesParsed, filesFailed } });

    const insertedFileNodes = await FileNode.insertMany(fileNodeDocs, { ordered: false });

    // --- Stage 4: Build dependency graph ---
    await reportProgress(job._id, repoId, {
      stage: 'building_graph',
      progressPercent: 65,
      progressMessage: 'Building dependency graph...',
    });

    const pathToFileNode = new Map(insertedFileNodes.map((f) => [f.filePath, f]));
    const rawEdges = buildDependencyEdges(insertedFileNodes.map((f) => f.toObject()));

    // Persist mutated resolvedPath/isExternal back onto FileNode.imports
    await persistResolvedImports(insertedFileNodes);

    const edgeDocs = rawEdges
      .map((e) => {
        const sourceNode = pathToFileNode.get(e.sourcePath);
        const targetNode = pathToFileNode.get(e.targetPath);
        if (!sourceNode || !targetNode) return null;
        return {
          repository: repository._id,
          analysisJob: job._id,
          source: sourceNode._id,
          target: targetNode._id,
          sourcePath: e.sourcePath,
          targetPath: e.targetPath,
          importedNames: e.importedNames,
        };
      })
      .filter(Boolean);

    const insertedEdges = edgeDocs.length
      ? await DependencyEdge.insertMany(edgeDocs, { ordered: false })
      : [];

    // --- Stage 5: Detect circular dependencies ---
    await reportProgress(job._id, repoId, {
      stage: 'detecting_cycles',
      progressPercent: 75,
      progressMessage: 'Detecting circular dependencies...',
    });

    const { cycles, filesInCycles, edgesInCycles } = detectCircularDependencies(
      edgeDocs.map((e) => ({ sourcePath: e.sourcePath, targetPath: e.targetPath }))
    );

    await markCyclesInDb({ insertedFileNodes, insertedEdges, filesInCycles, edgesInCycles, cycles });

    // --- Stage 6: Complexity is already computed per-file during parsing; aggregate now ---
    await reportProgress(job._id, repoId, {
      stage: 'computing_complexity',
      progressPercent: 85,
      progressMessage: 'Aggregating complexity metrics...',
    });

    // --- Stage 7: Health score ---
    await reportProgress(job._id, repoId, {
      stage: 'scoring_health',
      progressPercent: 92,
      progressMessage: 'Calculating health score...',
    });

    const freshFileNodes = await FileNode.find({ analysisJob: job._id });
    const metrics = computeHealthScore({
      fileNodes: freshFileNodes,
      cycles,
      filesInCyclesCount: filesInCycles.size,
      parseErrorCount: filesFailed,
    });

    const languageBreakdown = {};
    for (const f of freshFileNodes) {
      languageBreakdown[f.language] = (languageBreakdown[f.language] || 0) + 1;
    }
    const totalLinesOfCode = freshFileNodes.reduce((sum, f) => sum + (f.linesOfCode || 0), 0);

    const snapshot = await MetricsSnapshot.create({
      repository: repository._id,
      analysisJob: job._id,
      totalFiles: metrics.totalFiles,
      totalLinesOfCode,
      totalFunctions: metrics.totalFunctions,
      averageComplexity: metrics.averageComplexity,
      maxComplexity: metrics.maxComplexity,
      highComplexityFileCount: metrics.highComplexityFileCount,
      totalDependencyEdges: insertedEdges.length,
      circularDependencyCount: metrics.circularDependencyCount,
      filesInCycles: metrics.filesInCycles,
      languageBreakdown,
      healthScore: metrics.healthScore,
      healthGrade: metrics.healthGrade,
      scoreBreakdown: metrics.scoreBreakdown,
      topComplexFiles: metrics.topComplexFiles,
    });

    await Repository.findByIdAndUpdate(repository._id, {
      $set: {
        status: 'completed',
        latestAnalysisJob: job._id,
        latestMetricsSnapshot: snapshot._id,
        lastAnalyzedAt: new Date(),
        localClonePath: undefined,
      },
      $inc: { analysisCount: 1 },
    });

    const durationMs = Date.now() - startedAt;
    await AnalysisJob.findByIdAndUpdate(job._id, { $set: { durationMs } });
    await reportCompleted(job._id, repoId, {
      healthScore: metrics.healthScore,
      healthGrade: metrics.healthGrade,
      totalFiles: metrics.totalFiles,
      circularDependencyCount: metrics.circularDependencyCount,
    });

    logger.info(
      `Analysis complete: repo=${repository.fullName} job=${job._id} score=${metrics.healthScore} durationMs=${durationMs}`
    );

    return { snapshot, metrics };
  } catch (err) {
    logger.error(`Analysis failed: repo=${repository.fullName} job=${job._id} error=${err.message}`);
    await Repository.findByIdAndUpdate(repository._id, { $set: { status: 'failed', localClonePath: undefined } });
    await reportFailed(job._id, repoId, err);
    throw err;
  } finally {
    if (localPath) await cleanupClone(localPath);
  }
}

async function parseOneFile(file, repositoryId, analysisJobId) {
  const base = {
    repository: repositoryId,
    analysisJob: analysisJobId,
    filePath: file.filePath,
    fileName: file.fileName,
    extension: file.extension,
    language: file.language,
    sizeBytes: file.sizeBytes,
  };

  try {
    const source = await fs.readFile(file.absolutePath, 'utf-8');
    const parsed =
      file.language === 'python'
        ? parsePythonFile(source)
        : parseJavaScriptFile(source, file.filePath, file.extension);

    const complexities = parsed.functions.map((fn) => fn.cyclomaticComplexity);
    const fileComplexity = complexities.reduce((a, b) => a + b, 0);
    const averageComplexity = complexities.length ? fileComplexity / complexities.length : 0;
    const maxComplexity = complexities.length ? Math.max(...complexities) : 0;

    return {
      ...base,
      linesOfCode: parsed.linesOfCode,
      imports: parsed.imports,
      exports: parsed.exports,
      functions: parsed.functions,
      fileComplexity,
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      maxComplexity,
      isEntryPoint: /^(index|main|app|server)\.(js|jsx|ts|tsx|py)$/.test(file.fileName),
    };
  } catch (err) {
    return {
      ...base,
      linesOfCode: 0,
      imports: [],
      exports: [],
      functions: [],
      fileComplexity: 0,
      averageComplexity: 0,
      maxComplexity: 0,
      parseError: err.message.slice(0, 500),
    };
  }
}

async function persistResolvedImports(fileNodes) {
  const bulkOps = fileNodes.map((f) => ({
    updateOne: {
      filter: { _id: f._id },
      update: { $set: { imports: f.imports } },
    },
  }));
  if (bulkOps.length) await FileNode.bulkWrite(bulkOps, { ordered: false });
}

async function markCyclesInDb({ insertedFileNodes, insertedEdges, filesInCycles, edgesInCycles, cycles }) {
  if (filesInCycles.size > 0) {
    const cycleFileIds = insertedFileNodes.filter((f) => filesInCycles.has(f.filePath)).map((f) => f._id);
    await FileNode.updateMany({ _id: { $in: cycleFileIds } }, { $set: { inCycle: true } });
  }

  if (edgesInCycles.size > 0) {
    const cycleIdByEdgeKey = new Map();
    for (const cycle of cycles) {
      for (let i = 0; i < cycle.files.length - 1; i += 1) {
        cycleIdByEdgeKey.set(`${cycle.files[i]}=>${cycle.files[i + 1]}`, cycle.id);
      }
    }

    const bulkOps = [];
    for (const edge of insertedEdges) {
      const key = `${edge.sourcePath}=>${edge.targetPath}`;
      if (edgesInCycles.has(key)) {
        bulkOps.push({
          updateOne: {
            filter: { _id: edge._id },
            update: { $set: { isPartOfCycle: true, cycleId: cycleIdByEdgeKey.get(key) || 'unknown' } },
          },
        });
      }
    }
    if (bulkOps.length) await DependencyEdge.bulkWrite(bulkOps, { ordered: false });
  }
}

module.exports = { runAnalysisJob };
