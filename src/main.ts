import * as core from '@actions/core';
import { Octokit } from "@octokit/rest";
import { exec } from '@actions/exec';
import { downloadTool } from '@actions/tool-cache';
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";

type ReleaseType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.listReleases>[0]

const octokit = new Octokit();

async function installLatest() {
  core.startGroup("Query last successful build on master branch");

  const runs = await octokit.actions.listWorkflowRuns({
    owner: "nickg",
    repo: "nvc",
    workflow_id: "build-test.yml",
    branch: "master",
    per_page: 1,
    status: "success",
  });

  const artifacts = await octokit.actions.listWorkflowRunArtifacts({
    owner: "nickg",
    repo: "nvc",
    run_id: runs.data.workflow_runs[0].id,
  });

  for (const a of artifacts.data.artifacts) {
    console.log(a);
  }

  core.endGroup();
}

async function getStableRelease(): Promise<ReleaseType> {
  core.startGroup("Query latest stable release");

  const releases = await octokit.repos.listReleases({
    owner: 'nickg',
    repo: 'nvc',
    per_page: 1
  });

  const latest = releases.data[0];
  core.info(`Stable release is ${latest.name}`);

  core.endGroup();
  return latest;
}

async function getNamedRelease(name: string): Promise<ReleaseType> {
  core.startGroup(`Querying release ${name}`);

  try {
    const resp = await octokit.rest.repos.getReleaseByTag({
      owner: 'nickg',
      repo: 'nvc',
      tag: `r${name}`,
    });
    return resp.data;
  } catch (e) {
    throw new Error(`No release ${name}`);
  } finally {
    core.endGroup();
  }
}

async function installRelease(rel: ReleaseType) {
  let osVersion = '';
  await exec('bash', ['-c', '. /etc/os-release && echo $VERSION_ID'],
    {
      listeners: {
        stdout: (data) => { osVersion = data.toString().trim(); }
      }
    });

  //  osVersion = '22.04';

  core.info(`OS version is ${osVersion}`);

  let url = '', file = '';
  const suffix = `ubuntu-${osVersion}.deb`;
  for (const a of rel.assets) {
    if (a.name.endsWith(suffix)) {
      core.info(`Found matching asset ${a.name}`);
      url = a.browser_download_url;
      file = a.name;
      break;
    }
  }

  if (!url) {
    throw new Error(`No package for Ubuntu ${osVersion} in release ${rel.name}`);
  }

  core.startGroup(`Download ${file}`);

  const tmp = process.env['RUNNER_TEMP'];
  if (!tmp) {
    throw new Error("RUNNER_TEMP not set");
  }

  const pkg = await downloadTool(url, `${tmp}/${file}`);
  console.log(pkg);

  core.endGroup();

  core.startGroup("Install package");

  await exec('sudo', ['apt-get', 'install', pkg]);

  core.endGroup();
}

async function run() {
  let version = core.getInput("version") || "stable";
  core.info(`Requested version is ${version}`);

  if (version === "latest") {
    installLatest();
  } else if (version === "stable") {
    const rel = await getStableRelease();
    installRelease(rel);
  } else {
    const rel = await getNamedRelease(version);
    installRelease(rel);
  }
}

run();
