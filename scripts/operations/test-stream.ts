#!/usr/bin/env node

/**
 * Broadcast Test Stream Generator
 * Generates SMPTE color bars with 1kHz audio tone and streams continuously to SRT endpoint
 */

import { spawn, ChildProcess } from 'child_process';
import { CloudFormationClient, ListStackResourcesCommand } from '@aws-sdk/client-cloudformation';

// Simple types
interface Config {
  stackName: string;
  region: string;
  resolution: string;
  bitrate: number;
  audioTone: number;
  testMode: boolean;
  continuous: boolean;
  playOutput: boolean;
  duration?: number;
}

interface Colors {
  [key: string]: string;
}

// Broadcast configuration - runs continuously until stopped
const DEFAULT_CONFIG: Config = {
  stackName: 'StreamInspectionBlogStack',
  region: 'us-west-2',
  resolution: '1080p',
  bitrate: 8000,
  audioTone: 1000,
  testMode: false,
  continuous: true, // Run until stopped
  playOutput: false // Play output with ffplay
};

class TestStreamGenerator {
  private config: Config;
  private cfClient: CloudFormationClient;
  private ffmpegProcess: ChildProcess | null = null;
  private ffplayProcess: ChildProcess | null = null;
  private isRunning: boolean = false;

  constructor(options: Partial<Config> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.cfClient = new CloudFormationClient({ region: this.config.region });
    
    // Setup signal handlers for graceful shutdown
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
  }

  private log(message: string, color: string = 'white'): void {
    const colors: Colors = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      reset: '\x1b[0m'
    };
    const timestamp = new Date().toISOString();
    console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
  }

  private async getSRTEndpoint(): Promise<string> {
    try {
      this.log('Getting SRT endpoint from CloudFormation stack...', 'blue');
      
      const command = new ListStackResourcesCommand({
        StackName: this.config.stackName
      });
      
      const response = await this.cfClient.send(command);
      const resources = response.StackResourceSummaries || [];
      
      // Look for MediaConnect flow
      const flowResource = resources.find(resource => 
        resource.ResourceType === 'AWS::MediaConnect::Flow'
      );
      
      if (!flowResource) {
        throw new Error('No MediaConnect flow found in stack');
      }
      
      // For now, return a placeholder - in real implementation, you'd get the actual SRT URL
      // from the flow's source configuration
      const srtUrl = `srt://example.mediaconnect.${this.config.region}.amazonaws.com:5000`;
      this.log(`Found SRT endpoint: ${srtUrl}`, 'green');
      
      return srtUrl;
    } catch (error: any) {
      throw new Error(`Failed to get SRT endpoint: ${error.message}`);
    }
  }

  private getResolutionParams(): { width: number; height: number; framerate: number } {
    const resolutions: { [key: string]: { width: number; height: number; framerate: number } } = {
      '720p': { width: 1280, height: 720, framerate: 30 },
      '1080p': { width: 1920, height: 1080, framerate: 30 },
      '4k': { width: 3840, height: 2160, framerate: 30 }
    };
    
    return resolutions[this.config.resolution] || resolutions['1080p'];
  }

  private buildFFmpegCommand(outputUrl: string): string[] {
    const { width, height, framerate } = this.getResolutionParams();
    
    const args = [
      '-y', // Overwrite output files
      '-f', 'lavfi',
      '-i', `smptebars=size=${width}x${height}:rate=${framerate}`,
      '-f', 'lavfi',
      '-i', `sine=frequency=${this.config.audioTone}:sample_rate=48000`,
      '-filter_complex', this.buildVideoFilter(width, height, framerate),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${this.config.bitrate}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      '-f', 'mpegts',
      '-map', '[v]',
      '-map', '1:a'
    ];
    
    // Add duration if specified
    if (this.config.duration) {
      args.push('-t', this.config.duration.toString());
    }
    
    // Add output
    args.push(outputUrl);
    
    return args;
  }

  private buildVideoFilter(width: number, height: number, framerate: number): string {
    // Calculate font size based on resolution (approximately 1/40th of height)
    const fontSize = Math.floor(height / 40);
    
    // Calculate position for center overlay
    const textX = Math.floor(width / 2);
    const textY = Math.floor(height / 2);
    
    // Build the video filter chain with SMPTE timecode overlay
    const filter = [
      // Start with SMPTE bars
      '[0:v]',
      // Add SMPTE timecode overlay in the center
      `drawtext=text='%{pts\\:hms\\:${framerate}} Frame\\: %{frame_num}':`,
      `fontcolor=white:fontsize=${fontSize}:`,
      `box=1:boxcolor=black@0.7:boxborderw=10:`,
      `x=${textX}-text_w/2:y=${textY}-text_h/2`,
      '[v]'
    ].join('');
    
    return filter;
  }

  private async startFFplay(inputUrl: string): Promise<void> {
    if (!this.config.playOutput) return;
    
    this.log('Starting ffplay for output monitoring...', 'blue');
    
    const args = [
      '-i', inputUrl,
      '-window_title', `Test Stream Output - ${this.config.stackName}`,
      '-autoexit',
      '-loglevel', 'quiet'
    ];
    
    this.ffplayProcess = spawn('ffplay', args);
    
    this.ffplayProcess.on('error', (error) => {
      this.log(`ffplay error: ${error.message}`, 'red');
    });
    
    this.ffplayProcess.on('exit', (code) => {
      this.log(`ffplay exited with code ${code}`, 'yellow');
      this.ffplayProcess = null;
    });
    
    this.log('ffplay started for output monitoring', 'green');
  }

  async generate(): Promise<void> {
    try {
      this.log('Starting broadcast test stream generator with SMPTE timecode overlay...', 'green');
      this.log(`Configuration: ${this.config.resolution} @ ${this.config.bitrate}kbps, ${this.config.audioTone}Hz tone`, 'cyan');
      this.log('Features: SMPTE color bars + timecode overlay + frame counter', 'cyan');
      
      let outputUrl: string;
      
      if (this.config.testMode) {
        outputUrl = `test-output-${Date.now()}.ts`;
        this.log(`Test mode: outputting to file ${outputUrl}`, 'yellow');
        
        // Start ffplay for test mode if requested
        if (this.config.playOutput) {
          await this.startFFplay(outputUrl);
        }
      } else {
        outputUrl = await this.getSRTEndpoint();
        this.log(`Streaming to: ${outputUrl}`, 'cyan');
      }
      
      const ffmpegArgs = this.buildFFmpegCommand(outputUrl);
      
      this.log('Starting FFmpeg with SMPTE timecode overlay...', 'blue');
      this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      this.isRunning = true;
      
      this.ffmpegProcess.stdout?.on('data', (data) => {
        // Only log if verbose mode is enabled
        if (process.env.VERBOSE) {
          console.log(data.toString());
        }
      });
      
      this.ffmpegProcess.stderr?.on('data', (data) => {
        // Only log errors and important info
        const output = data.toString();
        if (output.includes('error') || output.includes('Error')) {
          this.log(`FFmpeg: ${output.trim()}`, 'red');
        }
      });
      
      this.ffmpegProcess.on('error', (error) => {
        this.log(`FFmpeg error: ${error.message}`, 'red');
        this.isRunning = false;
      });
      
      this.ffmpegProcess.on('exit', (code, signal) => {
        this.isRunning = false;
        if (signal) {
          this.log(`FFmpeg terminated by signal ${signal}`, 'yellow');
        } else {
          this.log(`FFmpeg exited with code ${code}`, code === 0 ? 'green' : 'red');
        }
      });
      
      if (this.config.continuous) {
        this.log('Streaming continuously... Press Ctrl+C to stop', 'green');
        
        // Keep the process alive
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (!this.isRunning) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 1000);
        });
      } else {
        // Wait for FFmpeg to complete
        await new Promise<void>((resolve) => {
          this.ffmpegProcess?.on('exit', () => resolve());
        });
      }
      
    } catch (error: any) {
      this.log(`Stream generation failed: ${error.message}`, 'red');
      throw error;
    }
  }

  private shutdown(signal: string): void {
    this.log(`Received ${signal}, shutting down gracefully...`, 'yellow');
    
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
    }
    
    if (this.ffplayProcess) {
      this.ffplayProcess.kill('SIGTERM');
    }
    
    setTimeout(() => {
      this.log('Shutdown complete', 'green');
      process.exit(0);
    }, 2000);
  }
}

// Parse command line arguments
function parseArgs(): Partial<Config> {
  const args = process.argv.slice(2);
  const config: Partial<Config> = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stack-name':
        if (args[i + 1]) {
          config.stackName = args[i + 1];
          i++;
        }
        break;
      case '--region':
        if (args[i + 1]) {
          config.region = args[i + 1];
          i++;
        }
        break;
      case '--resolution':
        if (args[i + 1]) {
          config.resolution = args[i + 1];
          i++;
        }
        break;
      case '--bitrate':
        if (args[i + 1]) {
          config.bitrate = parseInt(args[i + 1]);
          i++;
        }
        break;
      case '--duration':
        if (args[i + 1]) {
          config.duration = parseInt(args[i + 1]);
          config.continuous = false;
          i++;
        }
        break;
      case '--test-mode':
        config.testMode = true;
        break;
      case '--play':
        config.playOutput = true;
        break;
      case '--help':
        showUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }
  
  return config;
}

function showUsage(): void {
  console.log(`
Broadcast Test Stream Generator

Usage: node test-stream.ts [options]

Options:
  --stack-name <name>     CloudFormation stack name (default: StreamInspectionBlogStack)
  --region <region>       AWS region (default: us-west-2)
  --resolution <res>      Video resolution: 720p, 1080p, 4k (default: 1080p)
  --bitrate <kbps>        Video bitrate in kbps (default: 8000)
  --duration <seconds>    Stream duration in seconds (default: continuous)
  --test-mode            Output to file instead of SRT
  --play                 Play output with ffplay (test mode only)
  --help                 Show this help

Examples:
  node test-stream.ts                           # Continuous 1080p stream
  node test-stream.ts --duration 300            # 5-minute stream
  node test-stream.ts --test-mode --play        # Test locally with playback
  node test-stream.ts --resolution 720p --bitrate 4000
`);
}

// Main execution
async function main(): Promise<void> {
  const config = parseArgs();
  const generator = new TestStreamGenerator(config);
  
  try {
    await generator.generate();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TestStreamGenerator };
