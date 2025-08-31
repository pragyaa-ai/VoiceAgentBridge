// Using built-in fetch for HTTP requests (Node.js 18+)
import logger from '../utils/logger.js';

export interface SalesData {
  full_name: string;
  car_model: string;
  email_id: string;
  timestamp?: Date;
  session_id?: string;
}

export interface LMSResponse {
  success: boolean;
  message: string;
  lead_id?: string;
  error?: string;
}

export class LMSService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.LMS_API_URL || 'https://api.dummy-lms.com';
    this.apiKey = process.env.LMS_API_KEY || 'dummy-api-key';
  }

  async pushSalesData(salesData: SalesData): Promise<LMSResponse> {
    try {
      logger.info('Pushing sales data to LMS', { salesData });

      // For now, use a dummy API endpoint
      if (this.baseUrl.includes('dummy-lms.com')) {
        return this.simulateLMSPush(salesData);
      }

      // Real LMS API call
      const response = await fetch(`${this.baseUrl}/api/leads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...salesData,
          timestamp: new Date(),
          source: 'VoiceAgent Bridge',
          campaign: 'SingleInterface Car Sales'
        })
      });

      const responseData = await response.json();
      logger.info('LMS API response', { response: responseData });

      return {
        success: true,
        message: 'Sales data successfully pushed to LMS',
        lead_id: responseData.lead_id
      };

    } catch (error) {
      logger.error('Failed to push sales data to LMS', { error, salesData });
      
      return {
        success: false,
        message: 'Failed to push sales data to LMS',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async simulateLMSPush(salesData: SalesData): Promise<LMSResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate dummy lead ID
    const lead_id = `LEAD_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    logger.info('Simulated LMS push successful', { 
      salesData, 
      lead_id,
      simulated: true 
    });

    return {
      success: true,
      message: 'Sales data successfully pushed to LMS (simulated)',
      lead_id
    };
  }

  async validateLMSConnection(): Promise<boolean> {
    try {
      if (this.baseUrl.includes('dummy-lms.com')) {
        logger.info('Using dummy LMS - connection validated');
        return true;
      }

      const response = await fetch(`${this.baseUrl}/api/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('LMS connection validation failed', { error });
      return false;
    }
  }
}
