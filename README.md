docker run -d -p 3000:3000 \
 -e AWS_REGION=us-east-1 \
 -e AWS_ACCESS_KEY_ID= \
 -e AWS_SECRET_ACCESS_KEY= \
 -e OPENAI_API_KEY= \
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

login cli
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws

build and push
docker buildx build --platform linux/amd64,linux/arm64 -t public.ecr.aws/b2v6g4u0/carbon-footprint-service:multi-arch --push .
