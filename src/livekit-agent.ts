import { agents, JobContext } from '@livekit/agents';
import { VoicePipelineAgent } from '@livekit/agents';
import { openai } from '@livekit/agents-plugin-openai';
import { deepgram } from '@livekit/agents-plugin-deepgram';
import { silero } from '@livekit/agents-plugin-silero';
import { spotlightAgentConfig } from './agents/spotlight-agent.js';
import { LMSService } from './services/lms-service.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: './config/production.env' });

class SpotlightLiveKitAgent extends VoicePipelineAgent {
  private lmsService: LMSService;
  private capturedData: { [key: string]: any } = {};

  constructor() {
    super({
      stt: deepgram.STT({
        model: 'nova-2',
        language: 'en-IN', // Indian English
        smart_format: true,
        punctuate: true
      }),
      llm: openai.LLM({
        model: 'gpt-4o-mini',
        temperature: spotlightAgentConfig.temperature,
        instructions: spotlightAgentConfig.instructions,
        functions: spotlightAgentConfig.tools
      }),
      tts: openai.TTS({
        voice: spotlightAgentConfig.voice,
        model: 'tts-1',
        speed: 1.0
      }),
      vad: silero.VAD()
    });

    this.lmsService = new LMSService();
    this.setupFunctionHandlers();
  }

  private setupFunctionHandlers(): void {
    // Handle function calls from the LLM
    this.llm.on('function_call', async (functionCall) => {
      const { name, args } = functionCall;
      logger.info('Spotlight agent function call:', { name, args });

      try {
        let result: any;

        switch (name) {
          case 'capture_sales_data':
            result = await this.handleCaptureSalesData(args);
            break;
          case 'verify_sales_data':
            result = await this.handleVerifySalesData(args);
            break;
          case 'capture_all_sales_data':
            result = await this.handleCaptureAllSalesData(args);
            break;
          case 'push_to_lms':
            result = await this.handlePushToLMS(args);
            break;
          case 'download_sales_data':
            result = await this.handleDownloadSalesData(args);
            break;
          case 'disconnect_session':
            result = await this.handleDisconnectSession(args);
            break;
          default:
            result = { error: `Unknown function: ${name}` };
        }

        // Return result to LLM
        return result;

      } catch (error) {
        logger.error('Function call error:', { name, args, error });
        return { error: `Function execution failed: ${error.message}` };
      }
    });
  }

  private async handleCaptureSalesData(args: any): Promise<any> {
    const { field_name, field_value, verified } = args;
    
    this.capturedData[field_name] = {
      value: field_value,
      verified: verified,
      timestamp: new Date()
    };

    logger.info('Sales data captured:', { field_name, field_value, verified });
    
    return {
      success: true,
      message: `Captured ${field_name}: ${field_value}`,
      verified: verified
    };
  }

  private async handleVerifySalesData(args: any): Promise<any> {
    const { field_name, confirmed } = args;
    
    if (this.capturedData[field_name]) {
      this.capturedData[field_name].verified = confirmed;
      this.capturedData[field_name].verified_at = new Date();
    }

    logger.info('Sales data verified:', { field_name, confirmed });
    
    return {
      success: true,
      message: `Verified ${field_name}`,
      confirmed: confirmed
    };
  }

  private async handleCaptureAllSalesData(args: any): Promise<any> {
    const { full_name, car_model, email_id, all_verified } = args;
    
    const completeData = {
      full_name,
      car_model,
      email_id,
      all_verified,
      captured_at: new Date(),
      session_id: this.ctx?.room?.name || 'unknown'
    };

    // Store complete data
    this.capturedData.complete = completeData;

    logger.info('Complete sales data captured:', completeData);
    
    return {
      success: true,
      message: 'All sales data captured successfully',
      lead_id: `LEAD_${Date.now()}`,
      data: completeData
    };
  }

  private async handlePushToLMS(args: any): Promise<any> {
    const leadData = args.lead_data || this.capturedData.complete;
    
    if (!leadData) {
      return {
        success: false,
        error: 'No lead data available to push'
      };
    }

    try {
      const lmsResponse = await this.lmsService.pushSalesData({
        full_name: leadData.full_name,
        car_model: leadData.car_model,
        email_id: leadData.email_id,
        timestamp: new Date(),
        session_id: leadData.session_id
      });

      logger.info('Data pushed to LMS:', lmsResponse);
      
      return {
        success: true,
        message: 'Data successfully pushed to LMS',
        lms_response: lmsResponse
      };
    } catch (error) {
      logger.error('LMS push failed:', error);
      return {
        success: false,
        error: 'Failed to push data to LMS'
      };
    }
  }

  private async handleDownloadSalesData(args: any): Promise<any> {
    const { format } = args;
    
    logger.info('Sales data download requested:', { format, data: this.capturedData });
    
    return {
      success: true,
      message: 'Data download initiated',
      format: format,
      data: this.capturedData
    };
  }

  private async handleDisconnectSession(args: any): Promise<any> {
    const { reason } = args;
    
    logger.info('Session disconnect requested:', { reason });
    
    // Trigger handoff to Car Dealer agent
    this.emit('handoff_requested', {
      target_agent: 'car_dealer',
      captured_data: this.capturedData.complete,
      reason: reason
    });
    
    return {
      success: true,
      message: 'Session will be handed off to Car Dealer agent',
      handoff_target: 'car_dealer'
    };
  }
}

export async function entrypoint(ctx: JobContext): Promise<void> {
  logger.info('Starting Spotlight LiveKit Agent', {
    room: ctx.room.name,
    participant: ctx.room.participants.size
  });

  // Initialize LMS service
  const lmsService = new LMSService();
  const lmsConnected = await lmsService.validateLMSConnection();
  logger.info('LMS validation result:', { connected: lmsConnected });

  // Create and start Spotlight agent
  const agent = new SpotlightLiveKitAgent();
  
  // Wait for participant to join
  await ctx.waitForParticipant();
  logger.info('Participant joined, starting conversation');

  // Start the agent
  await agent.start(ctx.room);

  // Generate initial greeting
  await agent.say('Welcome! I\'m here to help you with your automotive needs. May I start by getting your full name?');

  logger.info('Spotlight agent started successfully');
}

// Main execution for LiveKit Agent
if (require.main === module) {
  const wsUrl = process.env.LIVEKIT_URL || 'wss://your-livekit-server.com';
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required');
    process.exit(1);
  }

  agents.cli.run_app({
    entrypoint_fnc: entrypoint,
    ws_url: wsUrl,
    api_key: apiKey,
    api_secret: apiSecret,
    agent_name: 'spotlight-agent'
  });
}
