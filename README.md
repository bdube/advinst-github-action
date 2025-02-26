# Advanced Installer GitHub Action

This action will integrate [Advanced Installer Tool](https://www.advancedinstaller.com) in the GitHub CI/CD workflow. It has the following capabilities:

* Deploy Advanced Installer on the GitHub runner.
* Build an Advanced Installer project (.AIP)

## Usage

See [action.yml](action.yml).

```yml
uses: bdube/advinst-github-action@main
with:
  advinst-version: '<version>'
  advinst-license: '<license_id>'
  advinst-enable-automation: '<true|false>'
  aip-path: '<aip_project_path>'
  aip-build-name: '<aip_project_build>'
  aip-package-name: '<output_package_name>'
  aip-output-dir: '<output_package_dir>'
  advinst-use-floating-license: '<true|false>'
  advinst-license-host: '<hostname_of_license_server>'
  advinst-license-port: <port_number_of_license_server>
  advinst-license-timeout-seconds: <timeout_in_seconds>
  aip-commands: |
    <command_1>
    <command_2>
```

The input parameters are of two categories:

* Tool Deploy Parameters - their names have format: **advinst-***
* AIP Project Parameters - their names have format: **aip-***

***IMPORTANT: By specifying only the Tool Parameters you can restrict the action usage to deploy only. You can use it when you plan on using Advanced Installer from  a [PowerShell script](https://www.advancedinstaller.com/user-guide/powershell-automation.html) or build a [Visual Studio project](https://www.advancedinstaller.com/user-guide/ai-ext-vs-project.html).***

### advinst-version

Advanced Installer version to deploy. If not specified the latest version will be used. For a list of valid versions please see the [versions history](http://www.advancedinstaller.com/version-history.html)

You can specify a custom download location by using the ***advancedinstaller_url*** environment variable.

### advinst-license

Advanced Installer license ID. This parameter is optional if you are using a [simple](https://www.advancedinstaller.com/user-guide/tutorial-simple.html) project type. Mutually exclusive with **advinst-use-floating-license**.

### advinst-enable-automation

Enable Advanced Installer [PowerShell automation](https://www.advancedinstaller.com/user-guide/powershell-automation.html). This capability needs [Advanced Installer 16.1](https://www.advancedinstaller.com/release-16.1.html) or higher.

### advinst-use-floating-license

Enable network license server. Mutually exclusive with **advinst-license**.

### advinst-license-host

Hostname of network license server.

### advinst-license-port

Port number of network license server.

### advinst-license-timeout-seconds

Maximum time to retry acquiring floating license.

### aip-path

The Advanced Installer project (.AIP) to be built. This is mandatory if for all the other **aip-*** parameters.

### aip-build-name

Advanced Installer project build to use. E.g. DefaultBuild.

### aip-package-name

Output package name. Since this option is related to a build, it requires **aip-build-name** to be specified.

### aip-output-dir

Result package location. Since this option is related to a build, it requires **aip-build-name** to be specified.

### aip-commands

Additional Advanced Installer arguments passed along with the package build command. E.g. SetVersion 1.2.3. For a complete list of supported commands see the [edit commands](https://www.advancedinstaller.com/user-guide/command-line-editing.html).

***IMPORTANT: The the changes made to the AIP file through the edit commands are available only during the pipeline. They will not be stored.***

## Examples

### 1. Deploy tool and build an aip project

```yml
name: Build Advanced Installer Project (.AIP)  Demo
on: [workflow_dispatch]
jobs:
  advinst-aip-build-demo:
    runs-on: windows-latest
    name: Build Aip Demo
    steps:
      - name: Check out repository code
        uses: actions/checkout@v2
      - name: Build AIP
        uses: caphyon/advinst-github-action@main
        with:
          advinst-version: '19.0'
          advinst-license: ${{ secrets.ADVINST_LICENSE_KEY }}
          advinst-enable-automation: 'true'
          aip-path: ${{ github.workspace }}\arhitect.aip
          aip-build-name: DefaultBuild
          aip-package-name: setup.msi
          aip-output-dir:  ${{ github.workspace }}\setup
          aip-commands: |
            SetProperty FOO="foo"
            SetVersion 1.2.0
      - name: Publish setup artifact
        uses: actions/upload-artifact@v2
        with:
          name: setup
          path: ${{ github.workspace }}\setup\setup.msi
```

### 2. Deploy tool and build aip project using PowerShell commands

```yml
name: Powershell Automation Demo
on: [workflow_dispatch]
jobs:
  advinst-com-demo:
    runs-on: windows-latest
    name: Advinst Automation Demo
    steps:
      - name: Check out repository code
        uses: actions/checkout@v2
      - name: Deploy Advinst
        uses: caphyon/advinst-github-action@main
        with:
          advinst-version: '19.0'
          advinst-license: ${{ secrets.ADVINST_LICENSE_KEY }}
          advinst-enable-automation: 'true'
      - name: Use Advinst Automation
        shell: pwsh
        run: |
          # Load the AIP project from checkout location
          $aipPath = join-path $env:GITHUB_WORKSPACE "simple.aip";
          Write-Host "AIP: $aipPath";
          $advinst = new-object -com advancedinstaller;
          $project = $advinst.LoadProject($aipPath);
          $productDetails = $project.ProductDetails;
          # Bump the ProductVersion
          $productDetails.Version = "1.2.0";
          Write-Host "Version: $productDetails.Version";
          # Build the project
          $project.Build();
```

### 3. Deploy tool and build an Advanced Installer Visual Studio project (.AIPROJ)

```yml
name: Build AIPROJ Demo
on: [workflow_dispatch]
jobs:
  aiproj-demo:
    runs-on: windows-latest
    name: Build Visual Studio Project (aiproj)
    steps:
      - name: Check out repository code
        uses: actions/checkout@v2
      - name: Deploy Advinst
        uses: caphyon/advinst-github-action@main
        with:
          advinst-version: '19.0'
          advinst-license: ${{ secrets.ADVINST_LICENSE_KEY }}
      - name: Add msbuild to PATH
        uses: microsoft/setup-msbuild@v1.1
      - name: Build app for release
        run: msbuild ${{ github.workspace }}\MyAwesomeApp\MyAwesomeApp.sln
```

### How To Use

For more examples on how to use this action in various scenarios checkout our [actions playground repo](https://github.com/Caphyon/github-actions-playground/tree/main/.github/workflows).

### Contact us

We would love to hear your feedback! Tell us how to improve this action at ***support at advancedinstaller dot com***, or
open a [Github Issue](https://github.com/Caphyon/advinst-github-action/issues).

On our website you can find a list with all the [CI/CD integrations for Advanced Installer](https://www.advancedinstaller.com/installer-continuous-integration.html).

