
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    // 1. Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing.");
    }

    // 2. Read user input
    const { sentence } = await request.json();

    if (
      !sentence ||
      typeof sentence !== "string" ||
      !sentence.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter an expense description.",
        },
        { status: 400 }
      );
    }

    // 3. Call Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",

      contents: `
        Extract expense information from this sentence:

        "${sentence.trim()}"

        Rules:
        - Extract the expense description.
        - Extract amount as a number.
        - Currency should default to INR.
        - Identify who paid.
        - Identify all participants.
        - Identify split type.
        - Never invent missing information.
        - If participants are missing, return [].
        - If payer is missing, return an empty string.
        - If split type is missing, use equal.
        - Return only structured JSON.
      `,

      config: {
        responseMimeType: "application/json",

        responseSchema: {
          type: "OBJECT",
          properties: {
            description: {
              type: "STRING",
            },
            amount: {
              type: "NUMBER",
            },
            currency: {
              type: "STRING",
            },
            paidBy: {
              type: "STRING",
            },
            participants: {
              type: "ARRAY",
              items: {
                type: "STRING",
              },
            },
            splitType: {
              type: "STRING",
            },
          },
          required: [
            "description",
            "amount",
            "currency",
            "paidBy",
            "participants",
            "splitType",
          ],
        },
      },
    });

    // 4. Check response
    const resultText = response.text;

    if (!resultText) {
      throw new Error("Gemini returned an empty response.");
    }

    // 5. Parse JSON
    let expense;

    try {
      expense = JSON.parse(resultText);
    } catch (error) {
      console.error("JSON parsing error:", resultText);
      throw new Error("Gemini returned invalid JSON.");
    }

    // 6. Validate amount
    const amount = Number(expense.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid expense amount.");
    }

    // 7. Prepare final expense
    const finalExpense = {
      description: expense.description || "Expense",
      amount,
      currency: expense.currency || "INR",
      paidBy: expense.paidBy || "",
      participants: Array.isArray(expense.participants)
        ? expense.participants
        : [],
      splitType: expense.splitType || "equal",
    };

    // 8. Return success
    return NextResponse.json({
      success: true,
      expense: finalExpense,
    });

  } catch (error) {
    console.error("Gemini API Error:", error);

    const message = String(error.message || "");

    const isUnavailable =
      error.status === 503 ||
      message.includes("UNAVAILABLE") ||
      message.includes('"code":503');

    return NextResponse.json(
      {
        success: false,
        error: isUnavailable
          ? "Gemini is temporarily busy. Please try again."
          : message || "Unable to process expense.",
      },
      {
        status: isUnavailable ? 503 : 500,
      }
    );
  }
}
