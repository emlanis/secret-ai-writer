# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies (adjust to match your SDK)
RUN pip install python-decouple 'secret-sdk>=1.8.1' secret-ai-sdk

# Copy ENTIRE project to /app in container
COPY . .

# Run the test script
CMD ["python", "tests/test_contract.py"]