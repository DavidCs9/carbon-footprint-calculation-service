import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || "us-west-2",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

app.use(bodyParser.json());
app.use(cors());

interface CalculationData {
  electricity: number;
  transportation: number;
  diet: number;
  otherFactors: number;
}

interface CalculationRequest {
  userId: string;
  data: CalculationData;
}

function calculateDetailedCarbonFootprint(data: CalculationData): number {
  const { electricity, transportation, diet, otherFactors } = data;
  return (
    electricity * 0.5 + transportation * 0.3 + diet * 0.2 + otherFactors * 0.1
  );
}

function isDataComplete(data: CalculationData): boolean {
  const { electricity, transportation, diet, otherFactors } = data;
  return (
    electricity !== undefined &&
    transportation !== undefined &&
    diet !== undefined &&
    otherFactors !== undefined
  );
}

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getAIAnalysis(
  carbonFootprint: number,
  data: CalculationData
): Promise<string> {
  const prompt = `
    Analyze the following carbon footprint data and provide personalized recommendations:
    - Total carbon footprint: ${carbonFootprint.toFixed(2)} kg CO2e
    - Electricity usage: ${data.electricity} kWh per month
    - Transportation: ${data.transportation} miles per week
    - Diet impact: ${data.diet} (scale of 0-100)
    - Other factors: ${data.otherFactors} (scale of 0-100)

    Please provide 3 specific recommendations to reduce the carbon footprint based on this data.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Using the latest GPT-4 model
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant specializing in environmental sustainability and carbon footprint reduction.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 300,
      n: 1,
      temperature: 0.7,
    });

    return (
      completion.choices[0].message.content || "No recommendations available."
    );
  } catch (error) {
    console.error("Error getting AI analysis:", error);
    return "Unable to generate recommendations at this time.";
  }
}

app.post(
  "/calculate",
  async (req: Request<{}, {}, CalculationRequest>, res: Response) => {
    const { userId, data } = req.body;

    if (!userId || !isDataComplete(data)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const detailedCarbonFootprint = calculateDetailedCarbonFootprint(data);
    const calculationId = uuidv4();

    try {
      const aiAnalysis = await getAIAnalysis(detailedCarbonFootprint, data);

      const params = {
        TableName: "ecoviz",
        Item: {
          userId,
          calculationId,
          carbonFootprint: detailedCarbonFootprint,
          calculationData: data,
          aiAnalysis,
          timestamp: new Date().toISOString(),
        },
      };

      await dynamoDB.put(params).promise();
      res.status(201).json({
        userId,
        calculationId,
        carbonFootprint: detailedCarbonFootprint,
        aiAnalysis,
        message: "Detailed calculation and AI analysis stored successfully",
      });
    } catch (error) {
      console.error("Error processing calculation:", error);
      res.status(500).json({ error: "Failed to process calculation" });
    }
  }
);

app.listen(port, () => {
  console.log(
    `Carbon Footprint Calculation Service listening at http://localhost:${port}`
  );
});
