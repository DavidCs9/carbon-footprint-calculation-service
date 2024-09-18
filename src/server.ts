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

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface HousingData {
  type: string;
  size: number;
  energy: {
    electricity: number;
    naturalGas: number;
    heatingOil: number;
  };
}

interface TransportationData {
  car: {
    milesDriven: number;
    fuelEfficiency: number;
  };
  publicTransit: {
    busMiles: number;
    trainMiles: number;
  };
  flights: {
    shortHaul: number;
    longHaul: number;
  };
}

interface FoodData {
  dietType: string;
  wasteLevel: string;
}

interface ConsumptionData {
  shoppingHabits: string;
  recyclingHabits: string;
}

interface CalculationData {
  housing: HousingData;
  transportation: TransportationData;
  food: FoodData;
  consumption: ConsumptionData;
}

interface CalculationRequest {
  userId: string;
  data: CalculationData;
}

function calculateHousingEmissions(data: HousingData): number {
  const { energy } = data;
  const electricityEmissions = energy.electricity * 0.42; // kg CO2 per kWh
  const naturalGasEmissions = energy.naturalGas * 5.3; // kg CO2 per therm
  const heatingOilEmissions = energy.heatingOil * 10.15; // kg CO2 per gallon
  return electricityEmissions + naturalGasEmissions + heatingOilEmissions;
}

function calculateTransportationEmissions(data: TransportationData): number {
  const { car, publicTransit, flights } = data;
  const carEmissions = (car.milesDriven / car.fuelEfficiency) * 8.89; // kg CO2 per gallon of gasoline
  const busEmissions = publicTransit.busMiles * 0.059; // kg CO2 per mile
  const trainEmissions = publicTransit.trainMiles * 0.041; // kg CO2 per mile
  const shortHaulFlightEmissions = flights.shortHaul * 1100; // kg CO2 per flight (assuming average 1500 km flight)
  const longHaulFlightEmissions = flights.longHaul * 4400; // kg CO2 per flight (assuming average 6000 km flight)
  return (
    carEmissions +
    busEmissions +
    trainEmissions +
    shortHaulFlightEmissions +
    longHaulFlightEmissions
  );
}

function calculateFoodEmissions(data: FoodData): number {
  const dietFactors = {
    "meat-heavy": 3.3,
    average: 2.5,
    vegetarian: 1.7,
    vegan: 1.5,
  };
  const wasteFactors = {
    low: 0.9,
    average: 1.0,
    high: 1.1,
  };
  const baseFoodEmissions =
    365 * (dietFactors[data.dietType as keyof typeof dietFactors] || 2.5);
  return (
    baseFoodEmissions *
    (wasteFactors[data.wasteLevel as keyof typeof wasteFactors] || 1.0)
  );
}

function calculateConsumptionEmissions(data: ConsumptionData): number {
  const shoppingFactors = {
    minimal: 0.5,
    average: 1.0,
    frequent: 1.5,
  };
  const recyclingFactors = {
    none: 1.2,
    some: 1.0,
    most: 0.8,
    all: 0.6,
  };
  const baseConsumptionEmissions = 1000; // Assume 1000 kg CO2 for average consumption
  return (
    baseConsumptionEmissions *
    (shoppingFactors[data.shoppingHabits as keyof typeof shoppingFactors] ||
      1.0) *
    (recyclingFactors[data.recyclingHabits as keyof typeof recyclingFactors] ||
      1.0)
  );
}

function calculateTotalCarbonFootprint(data: CalculationData): number {
  const housingEmissions = calculateHousingEmissions(data.housing);
  const transportationEmissions = calculateTransportationEmissions(
    data.transportation
  );
  const foodEmissions = calculateFoodEmissions(data.food);
  const consumptionEmissions = calculateConsumptionEmissions(data.consumption);

  return (
    housingEmissions +
    transportationEmissions +
    foodEmissions +
    consumptionEmissions
  );
}

async function getAIAnalysis(
  carbonFootprint: number,
  data: CalculationData
): Promise<string> {
  // Calculate percentage contributions (simplified)
  const totalEmissions = carbonFootprint;
  const housingEmissions =
    data.housing.energy.electricity * 0.4 +
    data.housing.energy.naturalGas * 5.3;
  const transportEmissions =
    data.transportation.car.milesDriven * 0.404 +
    (data.transportation.flights.shortHaul +
      data.transportation.flights.longHaul) *
      1000;
  const foodEmissions =
    data.food.dietType === "meat-heavy"
      ? 3000
      : data.food.dietType === "vegetarian"
      ? 1400
      : 2000;

  const housingPercentage = (housingEmissions / totalEmissions) * 100;
  const transportPercentage = (transportEmissions / totalEmissions) * 100;
  const foodPercentage = (foodEmissions / totalEmissions) * 100;

  // Identify top two contributors
  const contributors = [
    { name: "Housing", value: housingPercentage },
    { name: "Transportation", value: transportPercentage },
    { name: "Food", value: foodPercentage },
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);

  const prompt = `
    Analyze this user's carbon footprint (${carbonFootprint.toFixed(
      2
    )} kg CO2e/year):
    1. Housing (${housingPercentage.toFixed(1)}%): ${data.housing.type}, ${
    data.housing.size
  } people, ${data.housing.energy.electricity} kWh electricity, ${
    data.housing.energy.naturalGas
  } therms gas
    2. Transportation (${transportPercentage.toFixed(1)}%): ${
    data.transportation.car.milesDriven
  } miles driven, ${
    data.transportation.flights.shortHaul + data.transportation.flights.longHaul
  } flights/year
    3. Food (${foodPercentage.toFixed(1)}%): ${
    data.food.dietType
  } diet, Waste level: ${data.food.wasteLevel}
    4. Consumption: Shopping habits ${
      data.consumption.shoppingHabits
    }, Recycling habits ${data.consumption.recyclingHabits}

    Top contributors: ${contributors[0].name} and ${contributors[1].name}

    Provide 3 specific, actionable recommendations to reduce this carbon footprint, focusing on the top contributors. For each recommendation:
    1. Reference specific user data
    2. Estimate the potential CO2e reduction (in kg/year) if implemented
    3. Suggest a realistic goal (e.g., "Reduce car miles by 20%")

    Format as a numbered list with each recommendation containing: a) Advice, b) Data reference, c) Potential impact, d) Goal.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content:
            "You are a precise environmental sustainability expert. Provide concise, personalized, and actionable recommendations based on the user's specific data. Include potential impact calculations and realistic goals.",
        },
        { role: "user", content: prompt },
      ],
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

    if (!userId || !data) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const carbonFootprint = calculateTotalCarbonFootprint(data);
      const aiAnalysis = await getAIAnalysis(carbonFootprint, data);
      const calculationId = uuidv4();
      const averages = {
        global: 4000, // 4 tons in kg
        us: 16000, // 16 tons in kg
      };

      const params = {
        TableName: "ecoviz",
        Item: {
          userId,
          calculationId,
          carbonFootprint,
          calculationData: data,
          aiAnalysis,
          averages,
          timestamp: new Date().toISOString(),
        },
      };

      await dynamoDB.put(params).promise();
      res.status(201).json({
        userId,
        calculationId,
        carbonFootprint,
        aiAnalysis,
        averages,
        message:
          "Carbon footprint calculation and AI analysis stored successfully",
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
