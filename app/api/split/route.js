
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

// 3. Call Gemini with an improved prompt

const prompt = `
You are an intelligent expense-splitting assistant for SplitSmart.

Your task is to extract expense information from the user's sentence.

USER INPUT:
"${sentence.trim()}"

RULES:

1. DESCRIPTION:
Identify what the expense was for.
Examples: dinner, cab, groceries, coffee, movie.

2. AMOUNT:
Extract the exact numerical amount.
Never invent an amount.
If missing, return 0.

3. CURRENCY:
Default to INR unless another currency is specified.

4. PAID BY:
Identify who paid.

- If the user says "I paid", "Paid 600", or "I spent",
  assume the speaker (Me) paid.
- If a person's name is mentioned as the payer, use that name.
- If the payer cannot be determined, return an empty string.

5. PARTICIPANTS:
Identify everyone sharing the expense.

IMPORTANT PARTICIPANT RULES:

- "Me, Raj and Priya had dinner for 1200"
  -> 3 participants: Me, Raj, Priya.

- "900 cab split with 2 friends"
  -> 3 participants total (me + 2 friends).

- "Coffee 300, just me"
  -> 1 participant.

- "1500 groceries, 4 of us"
  -> 4 participants.

- "Paid 600 for movie, split 3 ways"
  -> 3 participants.

- "Dinner 2000 with Vikram and Aisha"
  -> 3 participants total if the speaker is included.

Use actual names whenever provided.
For unnamed participants, use neutral placeholders:
Person 1, Person 2, etc.

Never count the same person twice.

If participants are not mentioned, return an empty array.

6. SPLIT TYPE:
Default to equal splitting unless specified otherwise.
Recognize unequal, percentage and custom splits if mentioned.

7. OUTPUT:
Return ONLY valid JSON matching the schema.
Do not include explanations, Markdown or additional text.
Never guess missing information.
`;

const response = await ai.models.generateContent({
 model: "gemini-3.5-flash-lite",

  contents: prompt,

  config: {
    responseMimeType: "application/json",

    responseSchema: {
      type: "OBJECT",

      properties: {
        description: {
          type: "STRING"
        },

        amount: {
          type: "NUMBER"
        },

        currency: {
          type: "STRING"
        },

        paidBy: {
          type: "STRING"
        },

        participants: {
          type: "ARRAY",
          items: {
            type: "STRING"
          }
        },

        splitType: {
          type: "STRING"
        }
      },

      required: [
        "description",
        "amount",
        "currency",
        "paidBy",
        "participants",
        "splitType"
      ]
    }
  }
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
