import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

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

app.post(
  "/calculate",
  async (req: Request<{}, {}, CalculationRequest>, res: Response) => {
    const { userId, data } = req.body;

    if (!userId || !isDataComplete(data)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const detailedCarbonFootprint = calculateDetailedCarbonFootprint(data);
    const calculationId = uuidv4();

    const params = {
      TableName: "ecoviz",
      Item: {
        userId,
        calculationId,
        carbonFootprint: detailedCarbonFootprint,
        calculationData: data,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await dynamoDB.put(params).promise();
      res.status(201).json({
        userId,
        calculationId,
        carbonFootprint: detailedCarbonFootprint,
        message: "Detailed calculation stored successfully",
      });
    } catch (error) {
      console.error("Error storing calculation:", error);
      res.status(500).json({ error: "Failed to store calculation" });
    }
  }
);

app.listen(port, () => {
  console.log(
    `Carbon Footprint Calculation Service listening at http://localhost:${port}`
  );
});
