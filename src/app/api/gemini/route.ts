import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { message: "GEMINI_API_KEY is not configured in your .env file. Please set GEMINI_API_KEY to enable Gemini AI responses." },
                { status: 500 }
            );
        }

        const { messages, context } = await req.json();
        const lastMessage = messages[messages.length - 1];

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: { responseMimeType: "application/json" } // Force JSON
        });

        const prompt = `
You are an intelligent IoT System Assistant for "ThingsString".
SYSTEM CONTEXT:
${JSON.stringify(context, null, 2)}

User Input: "${lastMessage.content}"

INSTRUCTIONS:
1. Analyze the user's intent.
2. If the user wants to **control** an actuator (turn on/off, switch, toggle), identify the target device and actuator key from the context.
3. You MUST return a JSON object with this exact structure:
{
  "message": "Your conversational response to the user.",
  "action": {
    "type": "CONTROL",
    "deviceId": "exact_device_id_found_in_context",
    "actuatorKey": "actuator_name_or_key",
    "state": "ON" or "OFF"
  }
}
4. If NO action is needed, return the JSON with "action": null.
{
  "message": "Your answer...",
  "action": null
}

IMPORTANT:
- Only trigger an action if the user explicitly asks for it.
- If multiple devices match, ask for clarification in the "message" and set action to null.
- Ensure "deviceId" and "actuatorKey" exactly match the system context provided.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        return NextResponse.json(JSON.parse(response.text()));
    } catch (error: any) {
        console.error("Gemini API Detailed Error:", error);
        return NextResponse.json(
            { message: `AI Error: ${error.message}` },
            { status: 500 }
        );
    }
}
