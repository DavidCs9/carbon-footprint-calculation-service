import request from "supertest";
import express from "express";
import {
  calculateHousingEmissions,
  calculateTransportationEmissions,
  calculateFoodEmissions,
  calculateConsumptionEmissions,
  calculateTotalCarbonFootprint,
} from "./server";

const app = express();
app.use(express.json());

// Mock the main endpoint for testing
app.post("/calculate", (req, res) => {
  const { userId, data } = req.body;
  const carbonFootprint = calculateTotalCarbonFootprint(data);
  res.status(201).json({
    userId,
    carbonFootprint,
    message: "Carbon footprint calculation stored successfully",
  });
});

describe("Carbon Footprint Calculation Functions", () => {
  test("calculateHousingEmissions", () => {
    const housingData = {
      type: "apartment",
      size: 2,
      energy: {
        electricity: 1000,
        naturalGas: 500,
        heatingOil: 100,
      },
    };
    const emissions = calculateHousingEmissions(housingData);
    expect(emissions).toBeCloseTo(4085, 0); // 1000 * 0.42 + 500 * 5.3 + 100 * 10.15
  });

  test("calculateTransportationEmissions", () => {
    const transportationData = {
      car: {
        milesDriven: 10000,
        fuelEfficiency: 25,
      },
      publicTransit: {
        busMiles: 1000,
        trainMiles: 500,
      },
      flights: {
        shortHaul: 2,
        longHaul: 1,
      },
    };
    const emissions = calculateTransportationEmissions(transportationData);
    expect(emissions).toBeCloseTo(10235.5, 0); // (10000 / 25) * 8.89 + 1000 * 0.059 + 500 * 0.041 + 2 * 1100 + 1 * 4400
  });

  test("calculateFoodEmissions", () => {
    const foodData = {
      dietType: "average",
      wasteLevel: "low",
    };
    const emissions = calculateFoodEmissions(foodData);
    expect(emissions).toBeCloseTo(821.25, 0); // 365 * 2.5 * 0.9
  });

  test("calculateConsumptionEmissions", () => {
    const consumptionData = {
      shoppingHabits: "average",
      recyclingHabits: "most",
    };
    const emissions = calculateConsumptionEmissions(consumptionData);
    expect(emissions).toBe(800); // 1000 * 1.0 * 0.8
  });

  test("calculateTotalCarbonFootprint", () => {
    const data = {
      housing: {
        type: "apartment",
        size: 2,
        energy: {
          electricity: 1000,
          naturalGas: 500,
          heatingOil: 100,
        },
      },
      transportation: {
        car: {
          milesDriven: 10000,
          fuelEfficiency: 25,
        },
        publicTransit: {
          busMiles: 1000,
          trainMiles: 500,
        },
        flights: {
          shortHaul: 2,
          longHaul: 1,
        },
      },
      food: {
        dietType: "average",
        wasteLevel: "low",
      },
      consumption: {
        shoppingHabits: "average",
        recyclingHabits: "most",
      },
    };
    const totalEmissions = calculateTotalCarbonFootprint(data);
    expect(totalEmissions).toBeCloseTo(15941.75, 0); // Sum of all individual calculations
  });
});

describe("API Endpoints", () => {
  test("POST /calculate", async () => {
    const response = await request(app)
      .post("/calculate")
      .send({
        userId: "12345",
        data: {
          housing: {
            type: "apartment",
            size: 2,
            energy: {
              electricity: 1000,
              naturalGas: 500,
              heatingOil: 100,
            },
          },
          transportation: {
            car: {
              milesDriven: 10000,
              fuelEfficiency: 25,
            },
            publicTransit: {
              busMiles: 1000,
              trainMiles: 500,
            },
            flights: {
              shortHaul: 2,
              longHaul: 1,
            },
          },
          food: {
            dietType: "average",
            wasteLevel: "low",
          },
          consumption: {
            shoppingHabits: "average",
            recyclingHabits: "most",
          },
        },
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("userId", "12345");
    expect(response.body).toHaveProperty("carbonFootprint");
    expect(response.body.carbonFootprint).toBeCloseTo(15941.75, 0);
    expect(response.body).toHaveProperty(
      "message",
      "Carbon footprint calculation stored successfully"
    );
  });
});
