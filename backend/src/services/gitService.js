const path = require('path');
const fs = require('fs-extra');
const simpleGit = require('simple-git');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/**
 * Shallow-clones a public GitHub repo into a unique tmp directory.
 * Returns the local path. Caller is responsible for calling cleanupClone().
 */
async function cloneRepository(githubUrl, jobId, { accessToken } = {}) {
  await fs.ensureDir(env.clone.tmpDir);
  const targetDir = path.join(env.clone.tmpDir, jobId.toString());
  await fs.remove(targetDir); // in case of a stale leftover from a previous failed run

  let cloneUrl = githubUrl;
  if (accessToken) {
    // Inject token for private repo access: https://<token>@github.com/owner/repo.git
    cloneUrl = githubUrl.replace('https://', `https://${accessToken}@`);
  }

  const git = simpleGit({ timeout: { block: 120000 } });

  try {
    await git.clone(cloneUrl, targetDir, ['--depth', '1', '--single-branch']);
  } catch (err) {
    await fs.remove(targetDir).catch(() => {});
    const msg = /not found|repository .* does not exist/i.test(err.message)
      ? 'Repository not found or is private (private repo support requires a GitHub token)'
      : `Failed to clone repository: ${err.message}`;
    throw ApiError.badRequest(msg);
  }

  const size = await getDirectorySizeMb(targetDir);
  if (size > env.clone.maxRepoSizeMb) {
    await fs.remove(targetDir).catch(() => {});
    throw ApiError.badRequest(
      `Repository is too large to analyze (${size.toFixed(0)}MB, limit ${env.clone.maxRepoSizeMb}MB)`
    );
  }

  let lastCommitSha;
  let defaultBranch;
  try {
    const localGit = simpleGit(targetDir);
    const log = await localGit.log({ maxCount: 1 });
    lastCommitSha = log.latest ? log.latest.hash : undefined;
    const branchSummary = await localGit.branch();
    defaultBranch = branchSummary.current;
  } catch {
    // non-fatal — metadata is a nice-to-have
  }

  return { localPath: targetDir, lastCommitSha, defaultBranch };
}

async function getDirectorySizeMb(dirPath) {
  let total = 0;
  async function walk(p) {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') continue; // don't count git history
      const fullPath = path.join(p, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        total += stat.size;
      }
    }
  }
  await walk(dirPath);
  return total / (1024 * 1024);
}

async function cleanupClone(localPath) {
  if (!localPath) return;
  await fs.remove(localPath).catch(() => {});
}

module.exports = { cloneRepository, cleanupClone };
