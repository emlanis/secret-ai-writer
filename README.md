# Secret AI Writer

A privacy-focused AI writing platform that combines AI content generation with blockchain-based secure storage.

## Features

- Private Content Generation: Create new content with AI assistance without privacy concerns
- Content Enhancement: Multiple enhancement styles (grammar, creativity, professional tone, etc.)
- Secure Draft Management: Save, retrieve, and delete drafts with blockchain-level security
- Import/Export: Support for various formats (JSON, TXT, Markdown)

## Installation

### Prerequisites

Before installing Secret AI Writer, ensure you have the following installed:

- Node.js (v16 or higher)
- npm (v8 or higher)
- Python (v3.8 or higher)
- pip (for Python dependencies)

### Setting Up the Development Environment

1. Clone the repository

```bash
git clone https://github.com/emlanis/secret-ai-writer.git
cd secret-ai-writer
```

2. Install frontend dependencies

```bash
cd frontend
npm install
```

3. Install backend dependencies

```bash
cd ../backend
npm install
```

4. Install Python dependencies for AI integration

```bash
cd ../ai-bridge
pip install -r requirements.txt
```

5. Install mock blockchain dependencies (for development)

```bash
cd ../blockchain-mock
npm install
```

### Configuration

1. Set up environment variables

Create a `.env` file in the backend directory:

```
# Backend configuration
PORT=3001
NODE_ENV=development

# AI Service configuration
AI_SERVICE_URL=http://localhost:5000
AI_FALLBACK_ENABLED=true

# Blockchain configuration
BLOCKCHAIN_SERVICE_URL=http://localhost:3002
BLOCKCHAIN_FALLBACK_ENABLED=true
ENCRYPTION_KEY=your-development-encryption-key
```

Create a `.env` file in the frontend directory:

```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_VERSION=0.1.0
```

2. Configure the AI service

If you're using a different language model, update the configuration in `ai-bridge/config.py`.

## Usage

1. Start the backend server

```bash
cd backend
npm run dev
```

2. Start the AI service

```bash
cd ai-bridge
python app.py
```

3. Start the mock blockchain service (for development)

```bash
cd blockchain-mock
npm run dev
```

4. Start the frontend application

```bash
cd frontend
npm start
```

5. Access the application

Open your browser and navigate to `http://localhost:3000`

## Architecture

Secret AI Writer uses a modular architecture:

- Frontend: React-based UI with responsive design
- Backend: Node.js Express server
- AI Integration: Python bridge for LLM integration (with fallback mechanisms)
- Storage: Secure storage using blockchain implementation

## Development Mode vs. Production

In development mode, the application uses a mock blockchain for ease of testing. In production, it connects to the actual Secret Network.

To build for production:

```bash
# Build the frontend
cd frontend
npm run build

# Build the backend
cd ../backend
npm run build
```

## Troubleshooting

### Common Issues

1. AI Service Connection Issues

If you encounter issues connecting to the AI service:
- Ensure Python dependencies are installed
- Check that the AI service is running on the configured port
- Verify network connectivity between the backend and AI service

2. Blockchain Connection Issues

For mock blockchain issues:
- Ensure the mock service is running
- Check the configured URL in environment variables

For production blockchain issues:
- Verify your Secret Network configuration
- Ensure you have proper credentials configured

3. Node Version Incompatibility

If you encounter Node.js compatibility issues:
- Use nvm (Node Version Manager) to switch to a compatible version
- Ensure all dependencies are reinstalled after switching Node versions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Secret Network for providing the privacy-preserving blockchain platform
- Ollama for providing the AI service/implementation