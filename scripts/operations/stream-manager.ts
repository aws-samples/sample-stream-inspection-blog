#!/usr/bin/env node

/**
 * Simple Stream Manager
 * 
 * Basic management for MediaConnect flows, MediaLive channels, and GWLB Auto Scaling Group.
 * Focuses on core functionality without over-engineering.
 */

import { execSync } from 'child_process';

// Configuration
const DEFAULT_STACK_NAME = 'StreamInspectionBlogStack';
const DEFAULT_REGION = 'us-west-2';
const TIMEOUT_MS = 300000; // 5 minutes
const POLL_INTERVAL_MS = 10000; // 10 seconds

// Simple types
interface Flow {
  name: string;
  arn: string;
}

interface Channel {
  name: string;
  id: string;
}

interface AutoScalingGroup {
  name: string;
  targetGroupArn?: string;
}

interface Colors {
  [key: string]: string;
}

// Simple colors
const colors: Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class StreamManager {
  private stackName: string;
  private region: string;
  private flows: Flow[] = [];
  private channels: Channel[] = [];
  private autoScalingGroup: AutoScalingGroup | null = null;

  constructor(stackName: string = DEFAULT_STACK_NAME, region: string = DEFAULT_REGION) {
    this.stackName = stackName;
    this.region = region;
  }

  private log(message: string, color: string = 'reset'): void {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  private executeCommand(command: string): any {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      if (!result.trim()) {
        throw new Error('Command returned empty response');
      }
      
      return JSON.parse(result);
    } catch (error: any) {
      if (error.message.includes('JSON')) {
        throw new Error(`Command returned non-JSON response: ${command}`);
      }
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  private executeCommandNoJson(command: string): string {
    try {
      const result = execSync(command, { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return result.trim();
    } catch (error: any) {
      // Extract meaningful error message from AWS CLI output
      let errorMessage = error.message;
      if (error.stderr) {
        const stderrLines = error.stderr.toString().split('\n');
        const meaningfulError = stderrLines.find((line: string) => 
          line.includes('ValidationException') || 
          line.includes('ResourceNotFoundException') ||
          line.includes('InvalidParameterException') ||
          line.includes('An error occurred')
        );
        if (meaningfulError) {
          errorMessage = meaningfulError.trim();
        }
      }
      throw new Error(`Command failed: ${errorMessage}`);
    }
  }

  private async discoverResources(): Promise<void> {
    this.log('🔍 Discovering resources...', 'blue');
    
    try {
      // Get stack outputs
      const command = `aws cloudformation describe-stacks --stack-name "${this.stackName}" --region "${this.region}" --output json`;
      const result = this.executeCommand(command);
      const outputs = result.Stacks[0]?.Outputs || [];

      // Find MediaConnect flows
      this.flows = outputs
        .filter((output: any) => output.OutputKey?.includes('FlowArn'))
        .map((output: any) => ({
          name: output.OutputKey,
          arn: output.OutputValue
        }));

      // Find MediaLive channels by listing all channels and filtering
      try {
        const channelsResult = this.executeCommand(`aws medialive list-channels --region "${this.region}" --output json`);
        this.channels = channelsResult.Channels
          .filter((channel: any) => channel.Name?.includes('Stream') || channel.Name?.includes(this.stackName))
          .map((channel: any) => ({
            name: channel.Name,
            id: channel.Id
          }));
      } catch (error) {
        this.log('⚠️  Could not list MediaLive channels', 'yellow');
      }

      // Find Auto Scaling Group for security appliances
      try {
        const asgResult = this.executeCommand(`aws autoscaling describe-auto-scaling-groups --region "${this.region}" --output json`);
        
        // Debug: Log all ASGs found
        this.log(`🔍 Found ${asgResult.AutoScalingGroups?.length || 0} Auto Scaling Groups`, 'cyan');
        
        const securityASG = asgResult.AutoScalingGroups.find((asg: any) => {
          const hasSecurityAppliance = asg.AutoScalingGroupName.includes('SecurityAppliance');
          const hasStackTag = asg.Tags?.some((tag: any) => 
            tag.Key === 'aws:cloudformation:stack-name' && tag.Value === this.stackName
          );
          
          // Debug: Log ASG details
          if (hasSecurityAppliance || hasStackTag) {
            this.log(`🔍 Checking ASG: ${asg.AutoScalingGroupName} (SecurityAppliance: ${hasSecurityAppliance}, StackTag: ${hasStackTag})`, 'cyan');
          }
          
          return hasSecurityAppliance || hasStackTag;
        });
        
        if (securityASG) {
          this.autoScalingGroup = {
            name: securityASG.AutoScalingGroupName,
            targetGroupArn: securityASG.TargetGroupARNs?.[0]
          };
          this.log(`✅ Found ASG: ${securityASG.AutoScalingGroupName}`, 'green');
        } else {
          this.log('⚠️  No matching Auto Scaling Group found', 'yellow');
        }
      } catch (error) {
        this.log(`⚠️  Could not find Auto Scaling Group: ${error}`, 'yellow');
      }

      this.log(`✅ Found ${this.flows.length} flows, ${this.channels.length} channels, ${this.autoScalingGroup ? '1 ASG' : '0 ASG'}`, 'green');
    } catch (error: any) {
      throw new Error(`Failed to discover resources: ${error.message}`);
    }
  }

  private async setAutoScalingGroupCapacity(desiredCapacity: number): Promise<void> {
    if (!this.autoScalingGroup) {
      this.log('⚠️  No Auto Scaling Group found', 'yellow');
      return;
    }

    this.log(`🔧 Setting ASG desired capacity to ${desiredCapacity}...`, 'blue');
    
    try {
      this.executeCommandNoJson(`aws autoscaling set-desired-capacity --auto-scaling-group-name "${this.autoScalingGroup.name}" --desired-capacity ${desiredCapacity} --honor-cooldown --region "${this.region}"`);
      this.log(`✅ Set ASG desired capacity to ${desiredCapacity}`, 'green');
    } catch (error: any) {
      throw new Error(`Failed to set ASG capacity: ${error.message}`);
    }
  }

  private async waitForTargetsHealthy(): Promise<void> {
    if (!this.autoScalingGroup?.targetGroupArn) {
      this.log('⚠️  No target group found for health checks', 'yellow');
      return;
    }

    this.log('⏳ Waiting for GWLB targets to be healthy...', 'yellow');
    
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT_MS) {
      try {
        const result = this.executeCommand(`aws elbv2 describe-target-health --target-group-arn "${this.autoScalingGroup.targetGroupArn}" --region "${this.region}" --output json`);
        const targets = result.TargetHealthDescriptions || [];
        
        if (targets.length === 0) {
          this.log('⏳ No targets registered yet...', 'yellow');
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }

        const healthyTargets = targets.filter((target: any) => target.TargetHealth?.State === 'healthy');
        const totalTargets = targets.length;
        
        this.log(`📊 Healthy targets: ${healthyTargets.length}/${totalTargets}`, 'cyan');
        
        // Wait for at least 2 healthy targets (minimum for redundancy)
        if (healthyTargets.length >= 2) {
          this.log(`✅ GWLB targets are healthy`, 'green');
          return;
        }
        
      } catch (error: any) {
        this.log(`⚠️  Error checking target health: ${error.message}`, 'yellow');
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    
    this.log('⚠️  Timeout waiting for targets to be healthy', 'yellow');
  }

  private async waitForAutoScalingGroup(targetCapacity: number): Promise<void> {
    if (!this.autoScalingGroup) return;

    this.log(`⏳ Waiting for ASG to reach desired capacity of ${targetCapacity}...`, 'yellow');
    
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT_MS) {
      try {
        const result = this.executeCommand(`aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names "${this.autoScalingGroup.name}" --region "${this.region}" --output json`);
        const asg = result.AutoScalingGroups[0];
        
        if (asg) {
          const currentCapacity = asg.Instances?.length || 0;
          const inServiceInstances = asg.Instances?.filter((instance: any) => instance.LifecycleState === 'InService').length || 0;
          
          this.log(`📊 ASG instances: ${inServiceInstances}/${currentCapacity} in service, target: ${targetCapacity}`, 'cyan');
          
          if (targetCapacity === 0) {
            // For stopping, wait for all instances to be terminated
            if (currentCapacity === 0) {
              this.log(`✅ ASG scaled down to 0`, 'green');
              return;
            }
          } else {
            // For starting, wait for desired number of instances to be in service
            if (inServiceInstances >= targetCapacity) {
              this.log(`✅ ASG scaled up to ${targetCapacity}`, 'green');
              return;
            }
          }
        }
      } catch (error: any) {
        this.log(`⚠️  Error checking ASG status: ${error.message}`, 'yellow');
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    
    this.log('⚠️  Timeout waiting for ASG to reach target capacity', 'yellow');
  }

  private async startFlows(): Promise<void> {
    if (this.flows.length === 0) return;
    
    this.log('🚀 Starting MediaConnect flows...', 'blue');
    
    for (const flow of this.flows) {
      try {
        this.executeCommandNoJson(`aws mediaconnect start-flow --flow-arn "${flow.arn}" --region "${this.region}"`);
        this.log(`✅ Started ${flow.name}`, 'green');
      } catch (error: any) {
        if (error.message.includes('STANDBY')) {
          this.log(`⚠️  ${flow.name} already running`, 'yellow');
        } else {
          this.log(`❌ Failed to start ${flow.name}: ${error.message}`, 'red');
        }
      }
    }
  }

  private async stopFlows(): Promise<void> {
    if (this.flows.length === 0) return;
    
    this.log('🛑 Stopping MediaConnect flows...', 'blue');
    
    for (const flow of this.flows) {
      try {
        this.executeCommandNoJson(`aws mediaconnect stop-flow --flow-arn "${flow.arn}" --region "${this.region}"`);
        this.log(`✅ Stopped ${flow.name}`, 'green');
      } catch (error: any) {
        if (error.message.includes('ACTIVE')) {
          this.log(`⚠️  ${flow.name} already stopped`, 'yellow');
        } else {
          this.log(`❌ Failed to stop ${flow.name}: ${error.message}`, 'red');
        }
      }
    }
  }

  private async startChannels(): Promise<void> {
    if (this.channels.length === 0) return;
    
    this.log('🚀 Starting MediaLive channels...', 'blue');
    
    for (const channel of this.channels) {
      try {
        this.executeCommandNoJson(`aws medialive start-channel --channel-id "${channel.id}" --region "${this.region}"`);
        this.log(`✅ Started ${channel.name}`, 'green');
      } catch (error: any) {
        if (error.message.includes('IDLE')) {
          this.log(`⚠️  ${channel.name} already running`, 'yellow');
        } else {
          this.log(`❌ Failed to start ${channel.name}: ${error.message}`, 'red');
        }
      }
    }
  }

  private async stopChannels(): Promise<void> {
    if (this.channels.length === 0) return;
    
    this.log('🛑 Stopping MediaLive channels...', 'blue');
    
    for (const channel of this.channels) {
      try {
        this.executeCommandNoJson(`aws medialive stop-channel --channel-id "${channel.id}" --region "${this.region}"`);
        this.log(`✅ Stopped ${channel.name}`, 'green');
      } catch (error: any) {
        if (error.message.includes('RUNNING')) {
          this.log(`⚠️  ${channel.name} already stopped`, 'yellow');
        } else {
          this.log(`❌ Failed to stop ${channel.name}: ${error.message}`, 'red');
        }
      }
    }
  }

  private async waitForFlows(targetState: string): Promise<void> {
    if (this.flows.length === 0) return;
    
    this.log(`⏳ Waiting for flows to reach ${targetState}...`, 'yellow');
    
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT_MS) {
      let allReady = true;
      
      for (const flow of this.flows) {
        try {
          const result = this.executeCommand(`aws mediaconnect describe-flow --flow-arn "${flow.arn}" --region "${this.region}" --output json`);
          const status = result.Flow?.Status;
          
          if (status !== targetState && status !== 'ERROR') {
            allReady = false;
            break;
          }
        } catch (error) {
          allReady = false;
          break;
        }
      }
      
      if (allReady) {
        this.log(`✅ Flows ready`, 'green');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    
    this.log('⚠️  Timeout waiting for flows', 'yellow');
  }

  private async waitForChannels(targetState: string): Promise<void> {
    if (this.channels.length === 0) return;
    
    this.log(`⏳ Waiting for channels to reach ${targetState}...`, 'yellow');
    
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT_MS) {
      let allReady = true;
      
      for (const channel of this.channels) {
        try {
          const result = this.executeCommand(`aws medialive describe-channel --channel-id "${channel.id}" --region "${this.region}" --output json`);
          const state = result.State;
          
          if (state !== targetState && state !== 'ERROR') {
            allReady = false;
            break;
          }
        } catch (error) {
          allReady = false;
          break;
        }
      }
      
      if (allReady) {
        this.log(`✅ Channels ready`, 'green');
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    
    this.log('⚠️  Timeout waiting for channels', 'yellow');
  }

  private async showStatus(): Promise<void> {
    this.log('📊 Status', 'blue');
    
    // Auto Scaling Group status
    if (this.autoScalingGroup) {
      try {
        const result = this.executeCommand(`aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names "${this.autoScalingGroup.name}" --region "${this.region}" --output json`);
        const asg = result.AutoScalingGroups[0];
        
        if (asg) {
          const currentCapacity = asg.Instances?.length || 0;
          const inServiceInstances = asg.Instances?.filter((instance: any) => instance.LifecycleState === 'InService').length || 0;
          const desiredCapacity = asg.DesiredCapacity || 0;
          
          const color = inServiceInstances >= 2 ? 'green' : inServiceInstances > 0 ? 'yellow' : 'red';
          this.log(`  ASG ${this.autoScalingGroup.name}: ${inServiceInstances}/${currentCapacity} in service (desired: ${desiredCapacity})`, color);
          
          // Show target health if available
          if (this.autoScalingGroup.targetGroupArn) {
            try {
              const targetResult = this.executeCommand(`aws elbv2 describe-target-health --target-group-arn "${this.autoScalingGroup.targetGroupArn}" --region "${this.region}" --output json`);
              const targets = targetResult.TargetHealthDescriptions || [];
              const healthyTargets = targets.filter((target: any) => target.TargetHealth?.State === 'healthy').length;
              const targetColor = healthyTargets >= 2 ? 'green' : healthyTargets > 0 ? 'yellow' : 'red';
              this.log(`  GWLB Targets: ${healthyTargets}/${targets.length} healthy`, targetColor);
            } catch (error) {
              this.log(`  GWLB Targets: Unable to check`, 'yellow');
            }
          }
        }
      } catch (error) {
        this.log(`  ASG ${this.autoScalingGroup?.name || 'Unknown'}: ERROR`, 'red');
      }
    }
    
    // Flow status
    for (const flow of this.flows) {
      try {
        const result = this.executeCommand(`aws mediaconnect describe-flow --flow-arn "${flow.arn}" --region "${this.region}" --output json`);
        const status = result.Flow?.Status || 'UNKNOWN';
        const color = status === 'ACTIVE' ? 'green' : status === 'ERROR' ? 'red' : 'yellow';
        this.log(`  Flow ${flow.name}: ${status}`, color);
      } catch (error) {
        this.log(`  Flow ${flow.name}: ERROR`, 'red');
      }
    }
    
    // Channel status
    for (const channel of this.channels) {
      try {
        const result = this.executeCommand(`aws medialive describe-channel --channel-id "${channel.id}" --region "${this.region}" --output json`);
        const state = result.State || 'UNKNOWN';
        const color = state === 'RUNNING' ? 'green' : state === 'ERROR' ? 'red' : 'yellow';
        this.log(`  Channel ${channel.name}: ${state}`, color);
      } catch (error) {
        this.log(`  Channel ${channel.name}: ERROR`, 'red');
      }
    }
  }

  async start(): Promise<void> {
    this.log('🚀 Starting streaming infrastructure', 'green');
    
    await this.discoverResources();
    
    // Step 1: Scale up GWLB Auto Scaling Group
    await this.setAutoScalingGroupCapacity(2);
    await this.waitForAutoScalingGroup(2);
    await this.waitForTargetsHealthy();
    
    // Step 2: Start MediaConnect flows
    await this.startFlows();
    await this.waitForFlows('ACTIVE');
    
    // Step 3: Start MediaLive channels
    await this.startChannels();
    await this.waitForChannels('RUNNING');
    
    this.log('✅ Start complete', 'green');
    await this.showStatus();
  }

  async stop(): Promise<void> {
    this.log('🛑 Stopping streaming infrastructure', 'yellow');
    
    await this.discoverResources();
    
    // Step 1: Stop MediaLive channels
    await this.stopChannels();
    await this.waitForChannels('IDLE');
    
    // Step 2: Stop MediaConnect flows
    await this.stopFlows();
    await this.waitForFlows('STANDBY');
    
    // Step 3: Scale down GWLB Auto Scaling Group
    await this.setAutoScalingGroupCapacity(0);
    await this.waitForAutoScalingGroup(0);
    
    this.log('✅ Stop complete', 'green');
    await this.showStatus();
  }

  async restart(): Promise<void> {
    await this.stop();
    this.log('⏳ Waiting 10 seconds...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await this.start();
  }

  async status(): Promise<void> {
    await this.discoverResources();
    await this.showStatus();
  }
}

// Parse arguments
interface Args {
  command: string;
  stackName: string;
  region: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const command = args[0];
  
  let stackName = DEFAULT_STACK_NAME;
  let region = DEFAULT_REGION;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--stack-name' && args[i + 1]) {
      stackName = args[i + 1];
      i++;
    } else if (args[i] === '--region' && args[i + 1]) {
      region = args[i + 1];
      i++;
    }
  }
  
  return { command, stackName, region };
}

// Main execution
async function main(): Promise<void> {
  const { command, stackName, region } = parseArgs();
  
  if (!command || !['start', 'stop', 'status', 'restart'].includes(command)) {
    console.log(`
Usage: node stream-manager.ts <command> [options]

Commands:
  start     Start flows and channels
  stop      Stop flows and channels  
  status    Show current status
  restart   Stop then start

Options:
  --stack-name <name>   Stack name (default: ${DEFAULT_STACK_NAME})
  --region <region>     AWS region (default: ${DEFAULT_REGION})
`);
    process.exit(1);
  }
  
  const manager = new StreamManager(stackName, region);
  
  try {
    switch (command) {
      case 'start':
        await manager.start();
        break;
      case 'stop':
        await manager.stop();
        break;
      case 'status':
        await manager.status();
        break;
      case 'restart':
        await manager.restart();
        break;
    }
  } catch (error: any) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { StreamManager };
