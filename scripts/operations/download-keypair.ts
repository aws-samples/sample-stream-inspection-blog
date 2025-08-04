#!/usr/bin/env node

/**
 * Download EC2 Key Pair Script
 * 
 * Downloads the EC2 key pair private key from AWS Systems Manager Parameter Store
 * and saves it locally with proper permissions for SSH access.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const DEFAULT_STACK_NAME = 'StreamInspectionBlogStack';
const DEFAULT_REGION = 'us-west-2';
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'keys');

// Simple types
interface Colors {
  [key: string]: string;
}

interface KeyPair {
  keyName: string;
  parameterName: string;
}

interface Args {
  stackName: string;
  region: string;
  outputDir: string;
  keyName?: string;
  help: boolean;
}

// Colors for console output
const colors: Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = 'reset'): void {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

function error(message: string): void {
  log(`ERROR: ${message}`, 'red');
}

function success(message: string): void {
  log(`SUCCESS: ${message}`, 'green');
}

function info(message: string): void {
  log(`INFO: ${message}`, 'cyan');
}

function warning(message: string): void {
  log(`WARNING: ${message}`, 'yellow');
}

function showUsage(): void {
  console.log(`
EC2 Key Pair Download Utility

Downloads EC2 key pair private keys from AWS Systems Manager Parameter Store.

Usage: node download-keypair.ts [options]

Options:
  --stack-name <name>     CloudFormation stack name (default: ${DEFAULT_STACK_NAME})
  --region <region>       AWS region (default: ${DEFAULT_REGION})
  --output-dir <path>     Output directory for key files (default: ./keys)
  --key-name <name>       Specific key pair name to download (optional)
  --help                  Show this help message

Examples:
  node download-keypair.ts                                    # Download all keys from default stack
  node download-keypair.ts --key-name my-key                  # Download specific key
  node download-keypair.ts --output-dir ~/.ssh                # Save to ~/.ssh directory
  node download-keypair.ts --stack-name MyStack --region us-east-1

Notes:
  - Only key pairs created through AWS (after 2021) store private keys in Parameter Store
  - Downloaded keys are saved with 600 permissions for SSH compatibility
  - Keys are saved in PEM format as {key-name}.pem
`);
}

function executeCommand(command: string): any {
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

function executeCommandText(command: string): string {
  try {
    return execSync(command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error: any) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

async function findKeyPairs(stackName: string, region: string): Promise<KeyPair[]> {
  info(`Searching for key pairs in stack: ${stackName}`);
  
  try {
    // Get stack resources
    const command = `aws cloudformation list-stack-resources --stack-name "${stackName}" --region "${region}" --output json`;
    const result = executeCommand(command);
    
    const keyPairs: KeyPair[] = [];
    
    // Look for EC2 KeyPair resources
    for (const resource of result.StackResourceSummaries || []) {
      if (resource.ResourceType === 'AWS::EC2::KeyPair') {
        const keyName = resource.PhysicalResourceId;
        
        // Get KeyPairId for parameter name
        const keyPairCommand = `aws ec2 describe-key-pairs --key-names "${keyName}" --region "${region}" --query 'KeyPairs[0].KeyPairId' --output text`;
        const keyPairId = executeCommandText(keyPairCommand).trim();
        
        const parameterName = `/ec2/keypair/${keyPairId}`;
        
        keyPairs.push({
          keyName,
          parameterName
        });
        
        info(`Found key pair: ${keyName} (ID: ${keyPairId})`);
      }
    }
    
    if (keyPairs.length === 0) {
      warning('No EC2 key pairs found in the stack');
    }
    
    return keyPairs;
  } catch (error: any) {
    throw new Error(`Failed to find key pairs: ${error.message}`);
  }
}

async function downloadKeyPair(keyPair: KeyPair, outputDir: string, region: string): Promise<boolean> {
  const { keyName, parameterName } = keyPair;
  const outputPath = path.join(outputDir, `${keyName}.pem`);
  
  try {
    info(`Downloading key pair: ${keyName}`);
    
    // Get parameter from Systems Manager
    const command = `aws ssm get-parameter --name "${parameterName}" --with-decryption --region "${region}" --output json`;
    const result = executeCommand(command);
    
    const privateKey = result.Parameter?.Value;
    if (!privateKey) {
      throw new Error('Private key not found in parameter');
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      info(`Created output directory: ${outputDir}`);
    }
    
    // Write key file
    fs.writeFileSync(outputPath, privateKey, { mode: 0o600 });
    
    success(`Downloaded key pair: ${keyName} -> ${outputPath}`);
    return true;
    
  } catch (error: any) {
    if (error.message.includes('ParameterNotFound')) {
      warning(`Key pair ${keyName} not available for download (may be imported or created before 2021)`);
    } else {
      error(`Failed to download key pair ${keyName}: ${error.message}`);
    }
    return false;
  }
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  
  const result: Args = {
    stackName: DEFAULT_STACK_NAME,
    region: DEFAULT_REGION,
    outputDir: DEFAULT_OUTPUT_DIR,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stack-name':
        if (args[i + 1]) {
          result.stackName = args[i + 1];
          i++;
        }
        break;
      case '--region':
        if (args[i + 1]) {
          result.region = args[i + 1];
          i++;
        }
        break;
      case '--output-dir':
        if (args[i + 1]) {
          result.outputDir = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--key-name':
        if (args[i + 1]) {
          result.keyName = args[i + 1];
          i++;
        }
        break;
      case '--help':
        result.help = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
  
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();
  
  if (args.help) {
    showUsage();
    return;
  }
  
  info('EC2 Key Pair Download Utility');
  info(`Stack: ${args.stackName}`);
  info(`Region: ${args.region}`);
  info(`Output Directory: ${args.outputDir}`);
  
  try {
    // Find key pairs in stack
    const keyPairs = await findKeyPairs(args.stackName, args.region);
    
    if (keyPairs.length === 0) {
      process.exit(0);
    }
    
    // Filter by specific key name if provided
    const targetKeyPairs = args.keyName 
      ? keyPairs.filter(kp => kp.keyName === args.keyName)
      : keyPairs;
    
    if (args.keyName && targetKeyPairs.length === 0) {
      error(`Key pair '${args.keyName}' not found in stack`);
      process.exit(1);
    }
    
    // Download key pairs
    let successCount = 0;
    let failureCount = 0;
    
    for (const keyPair of targetKeyPairs) {
      const success = await downloadKeyPair(keyPair, args.outputDir, args.region);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    // Summary
    info(`Download complete: ${successCount} successful, ${failureCount} failed`);
    
    if (successCount > 0) {
      info(`Key files saved to: ${args.outputDir}`);
      info('Use with SSH: ssh -i keys/your-key.pem ec2-user@instance-ip');
    }
    
    process.exit(failureCount > 0 ? 1 : 0);
    
  } catch (error: any) {
    error(`Operation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { findKeyPairs, downloadKeyPair };
