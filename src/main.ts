import * as core from '@actions/core';
//import { Octokit, App } from "octokit";
import { Octokit } from "@octokit/rest";
import { exec } from '@actions/exec';
import { downloadTool } from '@actions/tool-cache';
import { listeners } from 'process';

async function run() {
  core.info("hello, world");

  const octokit = new Octokit();
  const releases = await octokit.rest.repos.listReleases(
    { owner: 'nickg', repo: 'nvc' });

  const latest = releases.data[0];

  console.log(latest);

  core.info(`Latest release is ${latest.name}`);

  let osVersion = '';
  await exec('bash', ['-c', '. /etc/os-release && echo $VERSION_ID'],
    {
      listeners: {
        stdout: (data) => { osVersion = data.toString().trim(); }
      }
    });

  //osVersion = '22.04';

  core.info(`OS version is ${osVersion}`);

  let url = '', file = '';
  const suffix = `ubuntu-${osVersion}.deb`;
  for (const a of latest.assets) {
    if (a.name.endsWith(suffix)) {
      core.info(`Found matching asset ${a.name}`);
      url = a.browser_download_url;
      file = a.name;
      break;
    }
  }

  if (!url) {
    throw new Error(`No package for Ubuntu ${osVersion} in release ${latest.name}`);
  }

  core.startGroup("Download package");

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

run();
