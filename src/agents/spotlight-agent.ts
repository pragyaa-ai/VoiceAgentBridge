// Spotlight agent configuration for OpenAI Realtime API
// Configuration object that defines the Spotlight automotive sales agent

export interface SpotlightAgentConfig {
  name: string;
  voice: string;
  instructions: string;
  tools: any[];
  temperature: number;
  max_response_output_tokens: number;
}

export const spotlightAgentConfig: SpotlightAgentConfig = {
  name: 'spotlight',
  voice: 'sage',
  temperature: 0.8,
  max_response_output_tokens: 4096,
  
  instructions: `You are Spotlight, a professional automotive sales assistant specializing in customer lead capture for car dealerships in India. You speak with a professional Indian English accent and can seamlessly switch between English and Hindi as needed.

**CORE IDENTITY:**
- Professional, friendly automotive sales expert
- Specialized in capturing high-quality sales leads
- Excellent listener with strong qualification skills
- Patient and thorough in data collection
- Culturally aware of Indian automotive market

**PRIMARY OBJECTIVE:**
Your main goal is to capture complete customer information for automotive sales leads:
1. Full Name (with proper spelling verification)
2. Car Model interested in (specific make/model/variant)
3. Email ID (verified format)

**DATA COLLECTION PROTOCOL:**
For each data point, follow this 3-step verification process:

1. **CAPTURE**: Ask the question naturally in conversation
2. **VERIFY**: Repeat back what you heard for confirmation
3. **CONFIRM**: Get explicit "yes" or "that's correct" before moving to next field

**CONFIRMATION PROTOCOL:**
After collecting each piece of information:
- "Let me confirm - your name is [NAME], spelled [spell it out]. Is that correct?"
- "So you're interested in the [CAR MODEL]. Is that the exact model you want to know about?"
- "Your email address is [EMAIL]. Should I send information to this email?"

**ESCALATION PROTOCOL:**
Once all 3 data points are captured and verified:
- Acknowledge completion: "Perfect! I have your complete information."
- Explain handoff: "I'm now connecting you with our Car Dealer specialist who will help you with pricing, availability, and next steps."
- Initiate handoff to Car Dealer agent

**AUDIO UPLOAD INSTRUCTIONS:**
If customer mentions they have images/documents to share:
- Guide them to upload through the interface
- Confirm receipt of uploads
- Include uploaded content context in handoff

**CONVERSATION FLOW:**
1. Warm greeting and introduction
2. Understand their automotive needs
3. Capture full name with spelling verification
4. Identify specific car model of interest
5. Collect and verify email address
6. Summarize captured information
7. Handoff to Car Dealer agent

**COMPLETION PROTOCOL:**
When all data is captured and verified:
1. Use capture_all_sales_data tool to save information
2. Use push_to_lms tool to send data to LMS
3. Use handoff tool to transfer to Car Dealer agent

**IMPORTANT GUIDELINES:**
- Never skip verification steps
- Always spell out names for confirmation
- Be specific about car models (ask for trim/variant)
- Validate email format before confirming
- Stay focused on lead capture, don't discuss pricing/financing
- Maintain professional tone throughout
- Use customer's preferred language (English/Hindi)

Remember: Quality lead capture is more important than speed. Take time to get accurate, complete information.`,

  tools: [
    {
      type: "function",
      name: "capture_sales_data",
      description: "Capture individual pieces of sales lead data as they are collected",
      parameters: {
        type: "object",
        properties: {
          field_name: {
            type: "string",
            enum: ["full_name", "car_model", "email_id"],
            description: "The type of data being captured"
          },
          field_value: {
            type: "string",
            description: "The actual value captured from the customer"
          },
          verified: {
            type: "boolean",
            description: "Whether this data has been verified with the customer"
          }
        },
        required: ["field_name", "field_value", "verified"]
      }
    },
    {
      type: "function", 
      name: "verify_sales_data",
      description: "Mark a piece of data as verified after customer confirmation",
      parameters: {
        type: "object",
        properties: {
          field_name: {
            type: "string",
            enum: ["full_name", "car_model", "email_id"],
            description: "The field being verified"
          },
          confirmed: {
            type: "boolean", 
            description: "Whether customer confirmed the data is correct"
          }
        },
        required: ["field_name", "confirmed"]
      }
    },
    {
      type: "function",
      name: "capture_all_sales_data", 
      description: "Capture complete sales lead data when all fields are collected and verified",
      parameters: {
        type: "object",
        properties: {
          full_name: {
            type: "string",
            description: "Customer's complete name"
          },
          car_model: {
            type: "string", 
            description: "Specific car model they're interested in"
          },
          email_id: {
            type: "string",
            description: "Customer's email address"
          },
          all_verified: {
            type: "boolean",
            description: "Confirmation that all data has been verified"
          }
        },
        required: ["full_name", "car_model", "email_id", "all_verified"]
      }
    },
    {
      type: "function",
      name: "push_to_lms",
      description: "Push verified sales lead data to the LMS system",
      parameters: {
        type: "object", 
        properties: {
          lead_data: {
            type: "object",
            description: "Complete lead information to send to LMS"
          }
        },
        required: ["lead_data"]
      }
    },
    {
      type: "function",
      name: "download_sales_data",
      description: "Download/export the captured sales data",
      parameters: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["json", "csv"],
            description: "Export format for the data"
          }
        },
        required: ["format"]
      }
    },
    {
      type: "function",
      name: "disconnect_session", 
      description: "End the current session and disconnect",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Reason for disconnecting"
          }
        },
        required: ["reason"]
      }
    }
  ]
};

// Tool execution functions that will be handled by the connector
export const spotlightTools = {
  capture_sales_data: async (input: any, details: any) => {
    console.log('Capturing sales data:', input);
    return { success: true, message: `Captured ${input.field_name}: ${input.field_value}` };
  },

  verify_sales_data: async (input: any, details: any) => {
    console.log('Verifying sales data:', input);
    return { success: true, message: `Verified ${input.field_name}` };
  },

  capture_all_sales_data: async (input: any, details: any) => {
    console.log('Capturing complete sales data:', input);
    return { 
      success: true, 
      message: 'All sales data captured successfully',
      lead_id: `LEAD_${Date.now()}`
    };
  },

  push_to_lms: async (input: any, details: any) => {
    console.log('Pushing to LMS:', input);
    return { 
      success: true, 
      message: 'Data pushed to LMS successfully',
      lms_id: `LMS_${Date.now()}`
    };
  },

  download_sales_data: async (input: any, details: any) => {
    console.log('Downloading sales data:', input);
    return { success: true, message: 'Data download initiated' };
  },

  disconnect_session: async (input: any, details: any) => {
    console.log('Disconnecting session:', input);
    return { success: true, message: 'Session ended successfully' };
  }
};