import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { exec } from "@actions/exec";
import { downloadTool } from "@actions/tool-cache";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";

type ReleaseType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.listReleases>[0];

const octokit = new Octokit();

async function getLatestRelease(): Promise<ReleaseType> {
  core.startGroup("Query latest stable release");

  const releases = await octokit.repos.listReleases({
    owner: "nickg",
    repo: "nvc",
    per_page: 1,
  });

  const latest = releases.data[0];
  core.info(`Stable release is ${latest.name}`);

  core.endGroup();
  return latest;
}

async function getNamedRelease(name: string): Promise<ReleaseType> {
  core.startGroup("Query release information");

  try {
    const resp = await octokit.rest.repos.getReleaseByTag({
      owner: "nickg",
      repo: "nvc",
      tag: `r${name}`,
    });
    return resp.data;
  }
  catch (e) {
    throw new Error(`No release ${name}`);
  }
  finally {
    core.endGroup();
  }
}

async function installRelease(rel: ReleaseType) {
  let osVersion = "";
  await exec("bash", ["-c", ". /etc/os-release && echo $VERSION_ID"],
    {
      listeners: {
        stdout: (data) => { osVersion = data.toString().trim(); }
      }
    });

  //  osVersion = '22.04';

  core.info(`OS version is ${osVersion}`);

  let url = "", file = "";
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
    throw new Error(
      `No package for Ubuntu ${osVersion} in release ${rel.name}`);
  }

  core.startGroup(`Download ${file}`);

  const tmp = process.env["RUNNER_TEMP"];
  if (!tmp) {
    throw new Error("RUNNER_TEMP not set");
  }

  const pkg = await downloadTool(url, `${tmp}/${file}`);
  core.debug(pkg);

  core.endGroup();

  core.startGroup("Install package");

  await exec("sudo", ["apt-get", "install", pkg]);

  core.endGroup();
}

async function run() {
  const version = core.getInput("version") || "latest";
  core.info(`Requested version is ${version}`);

  core.info(core.getInput("token"));

  if (version === "latest") {
    const rel = await getLatestRelease();
    installRelease(rel);
  }
  else {
    const rel = await getNamedRelease(version);
    installRelease(rel);
  }
}

run();
