# EcoViz Backend

## Overview

EcoViz is a comprehensive web application for calculating, visualizing, and reducing personal carbon footprints. This repository contains the backend codebase for the EcoViz project, providing robust API endpoints, data processing, and integration with various services to support the frontend application.

## Features

- **Carbon Footprint Calculation**: Accurate algorithms for processing user input data
- **Data Persistence**: Storage of user calculations and results
- **AI-Powered Recommendations**: Integration with OpenAI for personalized sustainability advice
- **Email Service**: Functionality to send calculation results via email
- **Authentication Ready**: Prepared for implementation of user authentication
- **Scalable Architecture**: Designed to handle increasing user load

## Technology Stack

- **Node.js**: JavaScript runtime for server-side logic
- **Express.js**: Web application framework for Node.js
- **TypeScript**: Typed superset of JavaScript for enhanced development experience
- **AWS SDK**: Integration with various AWS services
- **DynamoDB**: NoSQL database for storing user data and calculations
- **OpenAI API**: For generating AI-powered recommendations
- **Nodemailer**: Module for sending emails
- **dotenv**: Module to load environment variables from a file
- **cors**: Middleware to enable CORS with various options
- **body-parser**: Middleware to parse incoming request bodies

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- AWS account with DynamoDB set up
- OpenAI API key

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/your-username/ecoviz-backend.git
   ```

2. Navigate to the project directory:

   ```
   cd ecoviz-backend
   ```

3. Install dependencies:

   ```
   npm install
   ```

   or

   ```
   yarn install
   ```

4. Create a `.env` file in the root directory and add the following environment variables:

   ```
   PORT=3000
   AWS_REGION=your_aws_region
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   OPENAI_API_KEY=your_openai_api_key
   EMAIL_USER=your_email_address
   EMAIL_PASS=your_email_password
   ```

5. Start the server:

   ```
   npm start
   ```

   or

   ```
   yarn start
   ```

6. The server should now be running on `http://localhost:3000`.

## API Endpoints

### POST /calculate

Calculates the carbon footprint based on user input data.

**Request Body:**

```json
{
  "userId": "string",
  "data": {
    "housing": { ... },
    "transportation": { ... },
    "food": { ... },
    "consumption": { ... }
  }
}
```

**Response:**

```json
{
  "userId": "string",
  "calculationId": "string",
  "carbonFootprint": number,
  "aiAnalysis": "string",
  "averages": {
    "global": number,
    "us": number
  },
  "message": "string"
}
```

### POST /send-email-results

Sends calculation results to the user's email.

**Request Body:**

```json
{
  "email": "user@example.com",
  "results": {
    "carbonFootprint": number,
    "housing": number,
    "transportation": number,
    "food": number,
    "consumption": number
  }
}
```

**Response:**

```json
{
  "message": "Email sent successfully"
}
```

## Project Structure

```
src/
├── config/         # Configuration files
├── models/         # Data models and schemas
├── routes/         # API route definitions
├── services/       # Business logic and external service integrations
├── utils/          # Utility functions and helpers
└── server.ts       # Main server file
```

## Key Components

- `server.ts`: Main application file that sets up the Express server and defines routes
- `calculateCarbonFootprint.ts`: Core logic for carbon footprint calculations
- `openaiService.ts`: Integration with OpenAI API for generating recommendations
- `emailService.ts`: Email sending functionality using Nodemailer

## Error Handling and Logging

The application uses a combination of custom error handling middleware and Sentry for error tracking. All errors are logged and, where appropriate, reported to Sentry for monitoring and debugging.

## Testing

To run the test suite:

```
npm test
```

or

```
yarn test
```

## Deployment

The backend is designed to be deployed on AWS EC2 instances. Detailed deployment instructions can be found in the `DEPLOYMENT.md` file.

## Contribution Guidelines

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes and commit them: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Submit a pull request

Please ensure your code follows the existing style conventions and includes appropriate tests.

## Future Enhancements

- Implement user authentication system
- Expand AI recommendations with more detailed user data
- Develop a caching layer for frequently accessed data
- Implement webhook system for real-time updates
- Create admin dashboard for monitoring and analytics

## License

[MIT License](LICENSE)

## Contact

For any queries or support, please contact us at support@ecoviz.xyz.

---

Built with 💻 by the EcoViz Team
