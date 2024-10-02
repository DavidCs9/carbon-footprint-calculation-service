import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import cors from "cors";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import { body, validationResult } from "express-validator";

dotenv.config();

export const app = express();
app.use(bodyParser.json());
app.use(cors());
const port = process.env.PORT || 3000;
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: "noreply@ecoviz.xyz",
    pass: process.env.EMAIL_PASS,
  },
});

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

interface CarbonFootprintResults {
  carbonFootprint: number;
  housing: number;
  transportation: number;
  food: number;
  consumption: number;
}

interface UserCarbonFootprint {
  email: string;
  results: CarbonFootprintResults;
}

const createEmailTemplate = (results: CarbonFootprintResults) => {
  const totalFootprint = results.carbonFootprint.toFixed(2);
  const housingEmissions = results.housing.toFixed(1);
  const transportationEmissions = results.transportation.toFixed(1);
  const foodEmissions = results.food.toFixed(1);
  const consumptionEmissions = results.consumption.toFixed(1);

  const globalAverage = 4000; // kg CO2e
  const usAverage = 16000; // kg CO2e
  const globalComparison = (
    ((results.carbonFootprint - globalAverage) / globalAverage) *
    100
  ).toFixed(1);
  const usComparison = (
    ((results.carbonFootprint - usAverage) / usAverage) *
    100
  ).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your EcoViz Carbon Footprint Results</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #e0f2f1;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    header {
      background: linear-gradient(to right, #4caf50, #2196f3);
      padding: 30px;
      text-align: center;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
    }
    h1 {
      color: #ffffff;
      margin: 0;
    }
    main {
      padding: 30px;
    }
    h2 {
      color: #2e7d32;
      text-align: center;
    }
    .total-footprint {
      text-align: center;
      font-size: 28px;
      font-weight: bold;
      color: #4caf50;
      margin: 30px 0;
    }
    .breakdown {
      margin-bottom: 30px;
    }
    .breakdown h3 {
      color: #2e7d32;
    }
    .breakdown ul {
      list-style-type: none;
      padding: 0;
    }
    .breakdown li {
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 8px;
    }
    .breakdown li:nth-child(1) { background-color: #f1f8e9; }
    .breakdown li:nth-child(2) { background-color: #e3f2fd; }
    .breakdown li:nth-child(3) { background-color: #fff3e0; }
    .breakdown li:nth-child(4) { background-color: #f3e5f5; }
    .comparison {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #e8f5e9;
      border-radius: 8px;
    }
    .comparison h3 {
      color: #2e7d32;
      margin-top: 0;
    }
    .next-steps h3 {
      color: #2e7d32;
    }
    .button-container {
      text-align: center;
      margin-top: 20px;
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background-color: #4caf50;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 25px;
      margin-top: 20px;
      font-weight: bold;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #45a049;
    }
    footer {
      background-color: #f5f5f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>EcoViz</h1>
    </header>
    <main>
      <h2>Your Carbon Footprint Results</h2>
      <div class="total-footprint">
        ${totalFootprint} kg CO2e / year
      </div>
      <div class="breakdown">
        <h3>Breakdown</h3>
        <ul>
          <li>🏠 Housing: ${housingEmissions} kg CO2e</li>
          <li>🚗 Transportation: ${transportationEmissions} kg CO2e</li>
          <li>🍽️ Food: ${foodEmissions} kg CO2e</li>
          <li>🛍️ Consumption: ${consumptionEmissions} kg CO2e</li>
        </ul>
      </div>
      <div class="comparison">
        <h3>Comparison with Averages</h3>
        <p>Your carbon footprint is ${globalComparison}% ${
    parseFloat(globalComparison) > 0 ? "higher" : "lower"
  } than the global average and ${Math.abs(parseFloat(usComparison))}% ${
    parseFloat(usComparison) > 0 ? "higher" : "lower"
  } than the US average.</p>
      </div>
      <div class="next-steps">
        <h3>Next Steps</h3>
        <p>Visit our website to view detailed AI recommendations on how to reduce your carbon footprint.</p>
        <div class="button-container">
          <a href="https://ecoviz.xyz/results" class="button">View Full Results</a>
        </div>
      </div>
    </main>
    <footer>
      <p>This email was sent by EcoViz. Please do not reply to this message.</p>
    </footer>
  </div>
</body>
</html>`;
};

// New endpoint for sending email results
app.post(
  "/send-email-results",
  [
    body("email").isEmail().normalizeEmail(),
    body("results").isObject().notEmpty(),
    body("results.carbonFootprint").isNumeric(),
    body("results.housing").isNumeric(),
    body("results.transportation").isNumeric(),
    body("results.food").isNumeric(),
    body("results.consumption").isNumeric(),
  ],
  async (req: express.Request, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, results } = req.body;

    const mailOptions = {
      from: '"EcoViz" <noreply@ecoviz.xyz>',
      to: email,
      subject: "Your EcoViz Carbon Footprint Results",
      html: createEmailTemplate(results),
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: "Results email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  }
);

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the EcoViz API" });
});

export {
  calculateHousingEmissions,
  calculateTransportationEmissions,
  calculateFoodEmissions,
  calculateConsumptionEmissions,
  calculateTotalCarbonFootprint,
};

// Move the server start logic into a separate function
export const startServer = () => {
  app.listen(port, () => {
    console.log(
      `Carbon Footprint Calculation Service listening at http://localhost:${port}`
    );
  });
};

// Only start the server if this file is run directly
if (require.main === module) {
  startServer();
}
