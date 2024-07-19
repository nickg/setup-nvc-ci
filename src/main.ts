import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import { exec } from "@actions/exec";
import { downloadTool } from "@actions/tool-cache";
import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import fs from "node:fs/promises";

type ReleaseType = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.listReleases>[0];

const octokit = new Octokit();

async function getLatestRelease(): Promise<ReleaseType> {
  const releases = await octokit.repos.listReleases({
    owner: "nickg",
    repo: "nvc",
    per_page: 1,
  });

  const latest = releases.data[0];
  core.info(`Latest release is ${latest.name}`);

  return latest;
}

async function getNamedRelease(name: string): Promise<ReleaseType> {
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

async function downloadFile(url: string, name: string) {
  core.info(`Download ${name}`);

  const tmp = process.env["RUNNER_TEMP"];
  if (!tmp) {
    throw new Error("RUNNER_TEMP not set");
  }

  return downloadTool(url, `${tmp}/${name}`);
}

async function installLinux(rel: ReleaseType) {
  let osVersion = "";
  await exec("bash", ["-c", ". /etc/os-release && echo $VERSION_ID"],
    {
      listeners: {
        stdout: (data) => { osVersion = data.toString().trim(); }
      }
    });

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

  const pkg = await downloadFile(url, file);

  await exec("sudo", ["apt-get", "install", pkg]);
}

async function installWindows(rel: ReleaseType) {
  let url = "", file = "";
  for (const a of rel.assets) {
    if (a.name.endsWith(".msi")) {
      core.info(`Found matching asset ${a.name}`);
      url = a.browser_download_url;
      file = a.name;
      break;
    }
  }

  if (!url) {
    throw new Error(`No Windows installer in release ${rel.name}`);
  }

  const pkg = await downloadFile(url, file);

  const cmd =
    `msiexec.exe /i ${pkg.replace("/", "\\")} /qn  /l* .\\msilog.log`;
  await exec("powershell.exe", ["-Command", cmd]);

  const pathFile = process.env["GITHUB_PATH"];
  if (!pathFile) {
    throw new Error("GITHUB_PATH not set");
  }

  await fs.appendFile(pathFile, "C:\\Program Files\\NVC\\bin\n");
}

async function installRelease(rel: ReleaseType) {
  if (process.platform === "linux") {
    installLinux(rel);
  }
  else if (process.platform === "win32") {
    installWindows(rel);
  }
  else {
    throw new Error("Unsupported platform");
  }
}

async function run() {
  const version = core.getInput("version") || "latest";
  core.info(`Requested version is ${version}`);

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
