
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing.");
    }

    const { sentence } = await request.json();

    if (!sentence || typeof sentence !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Enter an expense description.",
        },
        { status: 400 }
      );
    }

    // Generate structured expense data using Gemini
    let response;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `
            Extract expense information from this sentence:

            "${sentence}"

            Return ONLY valid JSON in this format:

            {
              "description": "Expense description",
              "amount": 1800,
              "currency": "INR",
              "paidBy": "Person name",
              "participants": ["Person 1", "Person 2"],
              "splitType": "equal"
            }

            Rules:
            - Do not invent missing information.
            - Amount must be a number.
            - Participants must be an array.
            - Use INR if rupees are mentioned.
            - Return only JSON.
          `,
          config: {
            responseMimeType: "application/json",
          },
        });

        break;

      } catch (error) {
        const status = Number(error?.status ?? error?.code);

        // Retry only temporary errors, not invalid model errors.
        const retryable =
          status === 429 ||
          status >= 500 ||
          !status;

        if (!retryable || attempt === 2) {
          throw error;
        }

        await new Promise(resolve =>
          setTimeout(resolve, 1500 * (attempt + 1))
        );
      }
    }

    // Read and parse Gemini response
    const cleanedText = response.text.trim();
    const expense = JSON.parse(cleanedText);

    // Validate AI output
    if (
      !expense.description ||
      !Number.isFinite(Number(expense.amount)) ||
      Number(expense.amount) <= 0
    ) {
      throw new Error("Gemini returned invalid expense data.");
    }

    return NextResponse.json({
      success: true,
      expense: {
        description: expense.description,
        amount: Number(expense.amount),
        currency: expense.currency || "INR",
        paidBy: expense.paidBy || "Unknown",
        participants: Array.isArray(expense.participants)
          ? expense.participants
          : [],
        splitType: expense.splitType || "equal",
      },
    });

  } catch (error) {
    console.error("Gemini API Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "AI service is temporarily unavailable. Please try again.",
      },
      { status: 503 }
    );
  }
}
