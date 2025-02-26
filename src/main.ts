import * as core from '@actions/core';
import {getLatest, versionIsDeprecated} from './advinstversions';
import {ADVINST_VER_DEPRECATION_ERROR} from './messages';
import {AdvinstBuilder} from './advinstbuilder';
import {AdvinstTool} from './advinsttool';
import {isWindows} from './utils';
import util from 'util';

async function run(): Promise<void> {
  try {
    if (!isWindows()) {
      throw new Error('This action is only supported on Windows platforms');
    }
    const version = core.getInput('advinst-version') || (await getLatest());
    core.debug(`Advinst version: ${version}`);
    const license = core.getInput('advinst-license');
    core.debug(`Advinst license: ${license}`);
    const enable_com = core.getInput('advinst-enable-automation');
    core.debug(`Advinst enable com: ${enable_com}`);
    const floating_license = core.getInput('advinst-use-floating-license');
    core.debug(`Advinst use floating license: ${floating_license}`);
    const license_host = core.getInput('advinst-license-host');
    core.debug(`Advinst license host: ${license_host}`);
    const license_port = Number(core.getInput('advinst-license-port')) || 1024;
    core.debug(`Advinst enable com: ${license_port}`);
    const timeout_seconds =
      Number(core.getInput('advinst-license-timeout-seconds')) || 180;
    core.debug(`Advinst license timeout seconds: ${timeout_seconds}`);

    const [isDeprecated, minAllowedVer] = await versionIsDeprecated(version);
    if (isDeprecated) {
      core.warning(
        util.format(ADVINST_VER_DEPRECATION_ERROR, minAllowedVer, version)
      );
    }

    if (license && floating_license) {
      core.warning(
        'A license is configured and floating license is set to true. Configured license will be used.'
      );
    }

    core.startGroup('Advanced Installer Tool Deploy');
    const advinstTool = new AdvinstTool(
      version,
      license,
      enable_com === 'true',
      floating_license === 'true',
      license_host,
      license_port,
      timeout_seconds
    );
    const toolPath = await advinstTool.getPath();
    core.endGroup();

    const aipPath = core.getInput('aip-path');
    if (!aipPath) {
      core.debug('No AIP project path provided. Skipping project build step.');
      return;
    }

    core.startGroup(`${aipPath} project build`);
    const advinstRunner = new AdvinstBuilder(toolPath);
    advinstRunner.setAipPath(aipPath);
    advinstRunner.setAipBuildName(core.getInput('aip-build-name'));
    advinstRunner.setAipPackageName(core.getInput('aip-package-name'));
    advinstRunner.setAipOutputDir(core.getInput('aip-output-dir'));
    advinstRunner.setAipCommands(core.getInput('aip-commands'));
    await advinstRunner.run();
    core.endGroup();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message);
  }
}

run();
