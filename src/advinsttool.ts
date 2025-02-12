import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as toolCache from '@actions/tool-cache';

import {dirname, join} from 'path';
import {exists, getRunnerTempDir, getVariable} from './utils';
import util from 'util';

export class AdvinstTool {
  private version: string;
  private license: string;
  private enableCom: boolean;
  private floatingLicense: boolean;
  private licenseHost: string;
  private licensePort: number;
  private timeoutSeconds: number;

  private static readonly advinstCustomUrlVar = 'advancedinstaller_url';
  private static readonly advinstDownloadUrlTemplate =
    'https://www.advancedinstaller.com/downloads/%s/advinst.msi';
  private static readonly advinstExtractCmdTemplate =
    'msiexec /a "%s" TARGETDIR="%s" /qn';
  private static readonly advinstRegisterCmdTemplate = '%s /RegisterCI %s';
  private static readonly advinstStartComCmdTemplate = '%s /REGSERVER';
  private static readonly advinstComPathTemplate =
    '%s\\bin\\x86\\advancedinstaller.com';
  private static readonly asdvinstMsbuildTagetPathTemplate =
    '%s\\ProgramFilesFolder\\MSBuild\\Caphyon\\Advanced Installer';
  private static readonly advinstCheckLicenseServerCmdTemplate =
    '%s /registerfloating %s:%d -testconnection';

  private static readonly advinstCacheToolName = 'advinst';
  private static readonly advinstCacheToolArch = 'x86';

  private static readonly advinstMSBuildTargetsVar =
    'AdvancedInstallerMSBuildTargets';
  private static readonly advinstToolRootVar = 'AdvancedInstallerRoot';

  constructor(
    version: string,
    license: string,
    enableCom: boolean,
    floatingLicense = false,
    licenseHost = '',
    licensePort = 1024,
    timeoutSeconds = 180
  ) {
    this.version = version;
    this.license = license;
    this.enableCom = enableCom;
    this.floatingLicense = floatingLicense;
    this.licenseHost = licenseHost;
    this.licensePort = licensePort;
    this.timeoutSeconds = timeoutSeconds;
  }

  async getPath(): Promise<string> {
    //Check cache first
    core.info(`Checking cache for advinst tool with version: ${this.version}`);
    let toolRoot = toolCache.find(
      AdvinstTool.advinstCacheToolName,
      this.version,
      AdvinstTool.advinstCacheToolArch
    );

    //If not in cache, download and extract
    if (!toolRoot) {
      core.info('Tool not found in cache');
      const setup = await this.download();
      toolRoot = await this.extract(setup);
    } else {
      core.info('Tool found in cache');
    }

    //Register and enable COM
    const toolPath = util.format(AdvinstTool.advinstComPathTemplate, toolRoot);
    const ret = await exists(toolPath);
    if (!ret) {
      throw new Error(
        util.format('Expected to find %s, but it was not found.', toolPath)
      );
    }
    if (this.license) {
      await this.register(toolPath);
    } else if (this.floatingLicense) {
      await this.registerFloating(toolPath);
    }
    await this.registerCom(toolPath);
    this.exportVariables(toolRoot);

    //Add to PATH
    core.addPath(dirname(toolPath));

    return toolPath;
  }

  async download(): Promise<string> {
    //Check if a custom URL is set. If so, use it.
    const customUrl = getVariable(AdvinstTool.advinstCustomUrlVar);
    if (customUrl) {
      core.info(
        util.format('Using custom URL for advinst tool: %s', customUrl)
      );
      return await toolCache.downloadTool(customUrl);
    }

    core.info(`Downloading advinst tool with version: ${this.version}`);
    const url = util.format(
      AdvinstTool.advinstDownloadUrlTemplate,
      this.version
    );
    return await toolCache.downloadTool(url);
  }

  async extract(setupPath: string): Promise<string> {
    //Extract to agent temp folder
    core.info('Extracting advinst tool');
    const extractFolder = join(getRunnerTempDir(), 'advinst');
    const cmd = util.format(
      AdvinstTool.advinstExtractCmdTemplate,
      setupPath,
      extractFolder
    );
    const ret = await exec.getExecOutput(cmd);
    if (ret.exitCode !== 0) {
      throw new Error(ret.stdout);
    }
    return await toolCache.cacheDir(
      extractFolder,
      AdvinstTool.advinstCacheToolName,
      this.version,
      AdvinstTool.advinstCacheToolArch
    );
  }

  async register(toolPath: string): Promise<void> {
    if (this.license) {
      core.info('Registering advinst tool');
      const cmd = util.format(
        AdvinstTool.advinstRegisterCmdTemplate,
        toolPath,
        this.license
      );
      const ret = await exec.getExecOutput(cmd);
      if (ret.exitCode !== 0) {
        throw new Error(ret.stdout);
      }
    }
  }

  async registerFloating(toolPath: string): Promise<void> {
    if (this.floatingLicense) {
      core.info('Acquiring floating license');
      const cmd = util.format(
        AdvinstTool.advinstCheckLicenseServerCmdTemplate,
        toolPath,
        this.licenseHost,
        this.licensePort
      );
      //We need exec to ignore the return code so that control is returned
      //back to us rather than failing internally
      const options: exec.ExecOptions = {ignoreReturnCode: false};
      let ret = await exec.getExecOutput(cmd, [], options);
      //Exit code 0xE001006D (3_758_162_029) means no license slot is available
      //or another error occurred
      if (ret.exitCode !== 0) {
        core.info(`Could not acquire license: ${ret.exitCode} ${ret}`);
        //TODO: wait here and retry for up to timeoutSeconds
        //temporary hack: this is supposed to be a retry loop but let's
        //just schedule this to try again in timeoutSeconds hahaha
        core.info(`Waiting ${this.timeoutSeconds} seconds before trying again`);
        await this.sleep(this.timeoutSeconds);
        ret = await exec.getExecOutput(cmd, [], options);
        if (ret.exitCode !== 0) {
          throw new Error(ret.stdout);
        }
      } else {
        core.info('License slot is available, if we hurry now');
      }
    }
  }

  private async sleep(seconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async registerCom(toolPath: string): Promise<void> {
    if (this.enableCom) {
      core.info('Enabling advinst COM interface');
      const cmd = util.format(AdvinstTool.advinstStartComCmdTemplate, toolPath);
      const ret = await exec.getExecOutput(cmd);
      if (ret.exitCode !== 0) {
        throw new Error(ret.stdout);
      }
    }
  }

  exportVariables(toolRoot: string): void {
    core.exportVariable(AdvinstTool.advinstToolRootVar, toolRoot);
    core.exportVariable(
      AdvinstTool.advinstMSBuildTargetsVar,
      util.format(AdvinstTool.asdvinstMsbuildTagetPathTemplate, toolRoot)
    );
  }
}
