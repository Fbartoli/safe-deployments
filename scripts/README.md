# Scripts

## add-chain-id.ts

Automates the process of adding a chain ID to all deployment files for a specific Safe version.

### Usage

```bash
npm run add-chain-id -- --version="1.3.0" --chainId="4326" --deploymentType="canonical"
```

### Parameters

- `--version`: Safe version (e.g., `1.3.0`, `1.4.1`, `1.5.0`) - **without** the `v` prefix
- `--chainId`: Chain ID to add (e.g., `4326`)
- `--deploymentType`: Deployment type - must be one of:
  - `canonical`
  - `eip155`
  - `zksync`
- `--verbose`: (optional) Enable verbose output for debugging

### Examples

```bash
# Add chain ID 4326 with canonical deployment for Safe 1.3.0
npm run add-chain-id -- --version="1.3.0" --chainId="4326" --deploymentType="canonical"

# Add chain ID 988 with eip155 deployment for Safe 1.4.1
npm run add-chain-id -- --version="1.4.1" --chainId="988" --deploymentType="eip155"

# Verbose mode
npm run add-chain-id -- --version="1.5.0" --chainId="4326" --deploymentType="canonical" --verbose
```

### What it does

1. Validates that the version directory exists
2. Finds all JSON files in the version directory
3. For each file:
   - Parses the JSON structure
   - Inserts the chain ID in numerical order in the `networkAddresses` section
   - Handles existing chain IDs (adds to array if different deployment type)
   - Writes the updated JSON back to the file with proper formatting

### GitHub Actions

This script can be triggered via GitHub Actions workflow. See `.github/workflows/add-chain-id.yml` for details.

To trigger manually:
1. Go to the "Actions" tab in GitHub
2. Select "Add Chain ID" workflow
3. Click "Run workflow"
4. Fill in the required parameters:
   - Version (e.g., `1.3.0`)
   - Chain ID (e.g., `4326`)
   - Deployment Type (canonical, eip155, or zksync)
   - Create PR (checkbox to automatically create a PR)
5. Click "Run workflow"

The workflow will:
- Run the script to add the chain ID
- Format the JSON files
- Create a branch
- Commit the changes
- Create a pull request (if enabled)

