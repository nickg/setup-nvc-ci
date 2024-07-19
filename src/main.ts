import * as core from '@actions/core';
//import { Octokit, App } from "octokit";
import { Octokit } from "@octokit/rest";
import { exec } from '@actions/exec';
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

  core.info(`OS version is ${osVersion}`);

  let url = '';
  const suffix = `ubuntu-${osVersion}.deb`;
  for (const a of latest.assets) {
    if (a.name.endsWith(suffix)) {
      core.info(`Found matching asset ${a.name}`);
      url = a.browser_download_url;
      break;
    }
  }

  if (!url) {
    throw new Error(`No package for Ubuntu ${osVersion} in release ${latest.name}`);
  }
}

run();
