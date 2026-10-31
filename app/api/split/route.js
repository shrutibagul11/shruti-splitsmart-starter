
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request) {
  try {
    // 1. Read user input
    const { sentence } = await request.json();

    if (!sentence || typeof sentence !== "string" || !sentence.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter an expense description.",
        },
        { status: 400 }
      );
    }

    // 2. Call Gemini with automatic retries
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",

          contents: `
            Extract expense information from this sentence:

            "${sentence.trim()}"

            Instructions:
            - Extract the expense description.
            - Extract the amount as a number.
            - Extract the currency.
            - Identify who paid.
            - Identify all participants.
            - Identify the split type.
            - Do not invent missing information.
            - If participants are not mentioned, return an empty array.
            - If split type is not mentioned, use equal.
            - If payer is not mentioned, return an empty string.
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

        // Successful response
        break;

      } catch (error) {
        lastError = error;

        console.error(
          `Gemini attempt ${attempt + 1} failed:`,
          error.message
        );

        if (attempt === 3) {
          throw error;
        }

        // Retry after 2, 4 and 6 seconds
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 * (attempt + 1))
        );
      }
    }

    // 3. Check Gemini response
    if (!response || !response.text) {
      throw lastError || new Error("Gemini returned an empty response.");
    }

    // 4. Parse JSON
    let expense;

    try {
      expense = JSON.parse(response.text);
    } catch {
      throw new Error("Gemini returned an invalid JSON response.");
    }

    // 5. Validate expense amount
    if (
      !Number.isFinite(Number(expense.amount)) ||
      Number(expense.amount) <= 0
    ) {
      throw new Error("Please provide a valid expense amount.");
    }

    // 6. Return successful response
    return NextResponse.json({
      success: true,
      expense: {
        description: expense.description || "Expense",
        amount: Number(expense.amount),
        currency: expense.currency || "INR",
        paidBy: expense.paidBy || "",
        participants: Array.isArray(expense.participants)
          ? expense.participants
          : [],
        splitType: expense.splitType || "equal",
      },
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
          ? "Gemini is temporarily busy. Please try again in 30 seconds."
          : "Unable to process expense. " + message,
      },
      {
        status: isUnavailable ? 503 : 500,
      }
    );
  }
}
