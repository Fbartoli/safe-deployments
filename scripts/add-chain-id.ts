import { promises as fs } from 'node:fs';
import path from 'node:path';
import util from 'node:util';

import type { SingletonDeploymentJSON, AddressType } from '../src/types';

type Options = {
  version: string;
  chainId: string;
  deploymentType: AddressType;
  verbose: boolean;
};

function parseOptions(): Options {
  const options = {
    version: { type: 'string' },
    chainId: { type: 'string' },
    deploymentType: { type: 'string' },
    verbose: { type: 'boolean' },
  } as const;
  const { values } = util.parseArgs({ options });

  for (const option of ['version', 'chainId', 'deploymentType'] as const) {
    if (values[option] === undefined) {
      throw new Error(`missing --${option} flag`);
    }
  }

  const deploymentType = values.deploymentType as string;
  if (!['canonical', 'eip155', 'zksync'].includes(deploymentType)) {
    throw new Error(
      `invalid deploymentType: ${deploymentType}. Must be one of: canonical, eip155, zksync`
    );
  }

  return {
    version: values.version as string,
    chainId: values.chainId as string,
    deploymentType: deploymentType as AddressType,
    verbose: values.verbose === true,
  };
}

/**
 * Inserts a chain ID into the networkAddresses object in the correct numerical position
 */
function insertChainId(
  networkAddresses: Record<string, AddressType | AddressType[]>,
  chainId: string,
  deploymentType: AddressType
): Record<string, AddressType | AddressType[]> {
  const chainIdNum = parseInt(chainId, 10);
  if (isNaN(chainIdNum)) {
    throw new Error(`Invalid chain ID: ${chainId}`);
  }

  // Check if chain ID already exists
  if (chainId in networkAddresses) {
    const existing = networkAddresses[chainId];
    if (typeof existing === 'string') {
      // If it's a single deployment type and different, convert to array
      if (existing !== deploymentType) {
        networkAddresses[chainId] = [existing, deploymentType] as AddressType[];
      }
      // If same, no change needed
    } else if (Array.isArray(existing)) {
      // If it's an array, add if not present
      if (!existing.includes(deploymentType)) {
        networkAddresses[chainId] = [...existing, deploymentType] as AddressType[];
      }
    }
    return networkAddresses;
  }

  // Create new object with chain ID inserted in numerical order
  const entries = Object.entries(networkAddresses);
  const sortedEntries = entries.sort(([a], [b]) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    return numA - numB;
  });

  // Find insertion point
  let insertIndex = sortedEntries.length;
  for (let i = 0; i < sortedEntries.length; i++) {
    const [existingChainId] = sortedEntries[i];
    const existingNum = parseInt(existingChainId, 10);
    if (chainIdNum < existingNum) {
      insertIndex = i;
      break;
    }
  }

  // Insert the new chain ID
  sortedEntries.splice(insertIndex, 0, [chainId, deploymentType]);

  // Reconstruct the object
  return Object.fromEntries(sortedEntries);
}

async function processFile(
  filePath: string,
  chainId: string,
  deploymentType: AddressType,
  verbose: boolean
): Promise<boolean> {
  const debug = (...msg: unknown[]) => {
    if (verbose) {
      console.debug(...msg);
    }
  };

  debug(`Processing file: ${filePath}`);

  // Read and parse JSON file
  const content = await fs.readFile(filePath, 'utf-8');
  const deployment: SingletonDeploymentJSON = JSON.parse(content);

  // Check if chain ID already exists with the same deployment type
  const existing = deployment.networkAddresses[chainId];
  if (existing === deploymentType) {
    debug(`Chain ID ${chainId} already exists with deployment type ${deploymentType}, skipping`);
    return false;
  }

  // Insert chain ID
  const beforeCount = Object.keys(deployment.networkAddresses).length;
  deployment.networkAddresses = insertChainId(
    deployment.networkAddresses,
    chainId,
    deploymentType
  );
  const afterCount = Object.keys(deployment.networkAddresses).length;

  if (beforeCount === afterCount && existing) {
    debug(`Chain ID ${chainId} already exists, updated deployment types`);
  }

  // Write back to file with proper formatting (2 spaces indentation)
  const updatedContent = JSON.stringify(deployment, null, 2) + '\n';
  await fs.writeFile(filePath, updatedContent, 'utf-8');

  debug(`Updated file: ${filePath}`);
  return true;
}

async function main() {
  const options = parseOptions();
  const debug = (...msg: unknown[]) => {
    if (options.verbose) {
      console.debug(...msg);
    }
  };

  debug('Parsed options:');
  debug(options);
  debug(`Current working directory: ${process.cwd()}`);

  // Validate version directory exists (directories are prefixed with 'v')
  const versionDir = path.join(process.cwd(), 'src', 'assets', `v${options.version}`);
  debug(`Looking for version directory: ${versionDir}`);
  
  try {
    const stat = await fs.stat(versionDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path exists but is not a directory: ${versionDir}`);
    }
    debug(`Found version directory: ${versionDir}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debug(`Error accessing directory: ${err.code} - ${err.message}`);
    if (err.code === 'ENOENT') {
      throw new Error(`Version directory does not exist: ${versionDir}`);
    }
    throw error;
  }

  // Get all JSON files in the version directory
  const files = await fs.readdir(versionDir);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files found in ${versionDir}`);
  }

  debug(`Found ${jsonFiles.length} JSON files to process`);

  // Process each file
  let updatedCount = 0;
  for (const file of jsonFiles) {
    const filePath = path.join(versionDir, file);
    const updated = await processFile(
      filePath,
      options.chainId,
      options.deploymentType,
      options.verbose
    );
    if (updated) {
      updatedCount++;
    }
  }

  console.log(
    `Successfully added chain ID ${options.chainId} with deployment type "${options.deploymentType}" to ${updatedCount} files in version ${options.version}`
  );
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

