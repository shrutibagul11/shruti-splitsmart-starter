
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    const { sentence } = await request.json();

    if (!sentence || typeof sentence !== "string") {
      return NextResponse.json(
        { success: false, error: "Enter an expense description." },
        { status: 400 }
      );
    }

    let response;

    // Retry temporary Gemini failures
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `
            Extract expense information from this sentence:

            "${sentence}"

            Return ONLY valid JSON:
            {
              "description": "Expense description",
              "amount": 1800,
              "currency": "INR",
              "paidBy": "Person name",
              "participants": ["Person 1", "Person 2"],
              "splitType": "equal"
            }

            Do not invent missing information.
          `,
        });

        break;
      } catch (error) {
        if (attempt === 2) throw error;

        await new Promise(resolve =>
          setTimeout(resolve, 1500 * (attempt + 1))
        );
      }
    }

    const cleanedText = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const expense = JSON.parse(cleanedText);

    return NextResponse.json({
      success: true,
      expense,
    });

  } catch (error) {
    console.error("Gemini API Error:", error);

    return NextResponse.json({
      success: false,
      error: "AI service is temporarily unavailable. Please try again."
    }, { status: 503 });
  }
}
