const { Repository, AnalysisJob, MetricsSnapshot, FileNode, DependencyEdge } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { enqueueAnalysis } = require('../jobs/queues');
const cycleService = require('../services/cycleService');
const architectureService = require('../services/architectureService');

/**
 * Parses a GitHub URL into { ownerLogin, name, fullName }.
 * Accepts forms like:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo.git
 *  - git@github.com:owner/repo.git
 */
function parseGithubUrl(url) {
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)(\.git)?\/?$/i);
  if (!httpsMatch) return null;
  const [, ownerLogin, name] = httpsMatch;
  return { ownerLogin, name, fullName: `${ownerLogin}/${name}` };
}

// List all repos imported by the current user
const listRepositories = asyncHandler(async (req, res) => {
  const repos = await Repository.find({ owner: req.user._id })
    .sort({ createdAt: -1 })
    .populate('latestMetricsSnapshot');
  res.json({ success: true, data: { repositories: repos } });
});

// Get single repo by id (must belong to current user)
const getRepository = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id }).populate(
    'latestMetricsSnapshot'
  );
  if (!repo) throw ApiError.notFound('Repository not found');
  res.json({ success: true, data: { repository: repo } });
});

// Import a repo by URL (creates or reuses the record) and kicks off analysis
// via BullMQ. Progress is available by polling GET /repositories/jobs/:jobId
// or subscribing to the `repo:{repositoryId}` Socket.IO room.
const importRepository = asyncHandler(async (req, res) => {
  const { githubUrl } = req.body;
  if (!githubUrl) throw ApiError.badRequest('githubUrl is required');

  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) throw ApiError.badRequest('Invalid GitHub repository URL');

  let repo = await Repository.findOne({ owner: req.user._id, fullName: parsed.fullName });
  if (!repo) {
    repo = await Repository.create({
      owner: req.user._id,
      githubUrl,
      fullName: parsed.fullName,
      name: parsed.name,
      ownerLogin: parsed.ownerLogin,
      status: 'pending',
    });
  } else if (repo.status === 'cloning' || repo.status === 'analyzing') {
    throw ApiError.conflict('This repository is already being analyzed');
  }

  const analysisJob = await enqueueAnalysis(repo._id, req.user._id);

  res.status(202).json({
    success: true,
    data: { repository: repo, analysisJob },
    message: 'Repository queued for analysis',
  });
});

// Re-run analysis on an existing repository (e.g. after new commits)
const reanalyzeRepository = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (repo.status === 'cloning' || repo.status === 'analyzing') {
    throw ApiError.conflict('This repository is already being analyzed');
  }

  const analysisJob = await enqueueAnalysis(repo._id, req.user._id);
  res.status(202).json({ success: true, data: { analysisJob }, message: 'Re-analysis queued' });
});

// Graph data (nodes + edges) for the repo's latest completed analysis
const getRepositoryGraph = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (!repo.latestAnalysisJob) throw ApiError.notFound('This repository has not been analyzed yet');

  const [nodes, edges] = await Promise.all([
    FileNode.find({ analysisJob: repo.latestAnalysisJob }).select(
      'filePath fileName extension language linesOfCode fileComplexity averageComplexity inCycle isEntryPoint functions.length'
    ),
    DependencyEdge.find({ analysisJob: repo.latestAnalysisJob }).select(
      'sourcePath targetPath importedNames isPartOfCycle cycleId'
    ),
  ]);

  res.json({ success: true, data: { nodes, edges } });
});

// Higher-level "architecture" view: files grouped into layers by
// responsibility (Routes/Controllers/Services/Models, Pages/Components/
// Hooks/API Client, etc.) with aggregated, direction-aware layer-to-layer
// edges — distinct from both the raw file graph and a plain folder grouping.
const getRepositoryArchitecture = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (!repo.latestAnalysisJob) throw ApiError.notFound('This repository has not been analyzed yet');

  const [nodes, edges] = await Promise.all([
    FileNode.find({ analysisJob: repo.latestAnalysisJob }).select(
      'filePath fileName language linesOfCode fileComplexity averageComplexity inCycle'
    ),
    DependencyEdge.find({ analysisJob: repo.latestAnalysisJob }).select('sourcePath targetPath'),
  ]);

  const architecture = architectureService.buildArchitecture(nodes, edges);
  res.json({ success: true, data: { architecture } });
});


// grouped into ordered file chains for the graph page's Cycles panel.
const getRepositoryCycles = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (!repo.latestAnalysisJob) throw ApiError.notFound('This repository has not been analyzed yet');

  const cycles = await cycleService.getCyclesForAnalysis(repo);
  res.json({ success: true, data: { cycles } });
});

// Latest health metrics snapshot for the repo
const getRepositoryMetrics = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');
  if (!repo.latestMetricsSnapshot) throw ApiError.notFound('This repository has not been analyzed yet');

  const snapshot = await MetricsSnapshot.findById(repo.latestMetricsSnapshot);
  res.json({ success: true, data: { metrics: snapshot } });
});

// Health score (and a few companion metrics) across every past analysis run,
// oldest first — feeds the "Health score history" line chart on the metrics
// page. Free given the existing data model: one MetricsSnapshot already
// exists per completed AnalysisJob, we just need them all instead of latest.
const MAX_HISTORY_POINTS = 100;

const getRepositoryMetricsHistory = asyncHandler(async (req, res) => {
  const repo = await Repository.findOne({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');

  const snapshots = await MetricsSnapshot.find({ repository: repo._id })
    .sort({ createdAt: 1 })
    .limit(MAX_HISTORY_POINTS)
    .select('healthScore healthGrade circularDependencyCount averageComplexity totalFiles createdAt');

  res.json({ success: true, data: { history: snapshots } });
});

const deleteRepository = asyncHandler(async (req, res) => {
  const repo = await Repository.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!repo) throw ApiError.notFound('Repository not found');

  // Cascade cleanup of related documents
  await Promise.all([
    AnalysisJob.deleteMany({ repository: repo._id }),
    MetricsSnapshot.deleteMany({ repository: repo._id }),
  ]);

  res.json({ success: true, message: 'Repository deleted' });
});

// Get analysis job status (for polling / fallback to Socket.IO)
const getAnalysisStatus = asyncHandler(async (req, res) => {
  const job = await AnalysisJob.findOne({ _id: req.params.jobId, user: req.user._id });
  if (!job) throw ApiError.notFound('Analysis job not found');
  res.json({ success: true, data: { job } });
});

module.exports = {
  listRepositories,
  getRepository,
  importRepository,
  reanalyzeRepository,
  deleteRepository,
  getAnalysisStatus,
  getRepositoryGraph,
  getRepositoryArchitecture,
  getRepositoryCycles,
  getRepositoryMetrics,
  getRepositoryMetricsHistory,
  parseGithubUrl,
};
