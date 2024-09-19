docker run -d -p 3000:3000 \
 -e AWS_REGION=us-east-1 \
 -e AWS_ACCESS_KEY_ID= \
 -e AWS_SECRET_ACCESS_KEY= \
 -e OPENAI_API_KEY= \
 -e EMAIL_PASS= \
 public.ecr.aws/b2v6g4u0/carbon-footprint-service:multi-arch

curl -X POST http://localhost:3000/calculate \
 -H "Content-Type: application/json" \
 -d '{
"userId": "testuser123",
"data": {
"housing": {
"type": "apartment",
"size": 2,
"energy": {
"electricity": 3000,
"naturalGas": 500,
"heatingOil": 0
}
},
"transportation": {
"car": {
"milesDriven": 10000,
"fuelEfficiency": 25
},
"publicTransit": {
"busMiles": 1000,
"trainMiles": 500
},
"flights": {
"shortHaul": 2,
"longHaul": 1
}
},
"food": {
"dietType": "average",
"wasteLevel": "average"
},
"consumption": {
"shoppingHabits": "average",
"recyclingHabits": "most"
}
}
}'

login cli
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

build and push
docker buildx build --platform linux/amd64,linux/arm64 -t public.ecr.aws/b2v6g4u0/carbon-footprint-service:multi-arch --push .

ec2 commands
pull latest image
docker pull public.ecr.aws/b2v6g4u0/carbon-footprint-service:multi-arch
