docker run -d -p 3000:3000 \
 -e AWS_REGION=us-east-1 \
 -e AWS_ACCESS_KEY_ID= \
 -e AWS_SECRET_ACCESS_KEY= \
 public.ecr.aws/b2v6g4u0/carbon-footprint-service:multi-arch

curl -X POST http:44.192.45.247:3000/calculate \
-H "Content-Type: application/json" \
-d '{
"userId": "testuser123",
"data": {
"electricity": 100,
"transportation": 50,
"diet": 75,
"otherFactors": 25
}
}'
