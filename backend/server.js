const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create mock_service.js if it doesn't exist
const mockServicePath = path.join(__dirname, 'mock_service.js');
if (!fs.existsSync(mockServicePath)) {
  fs.writeFileSync(
    mockServicePath,
    `// mock_service.js - Multiple drafts support
const fs = require('fs');
const path = require('path');

// Mock storage system using local files
class MockStorage {
  constructor() {
    this.storageDir = path.join(__dirname, 'mock_storage');
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }
  
  // Store a draft
  storeDraft(userAddress, content, metadata = {}) {
    // Create a unique id for the draft
    const draftId = \`draft_\${Date.now()}_\${Math.random().toString(36).substring(2, 9)}\`;
    
    // Create draft object with current timestamp
    const draftData = {
      id: draftId,
      content,
      metadata: {
        ...metadata,
        timestamp: Date.now(),  // Use current time in milliseconds
        title: metadata.title || \`Draft \${new Date().toLocaleString()}\`
      },
      tx_hash: \`mock_tx_\${Math.random().toString(36).substring(2, 15)}\`
    };
    
    // Get or create user drafts file
    const userFilePath = path.join(this.storageDir, \`\${userAddress}.json\`);
    let userDrafts = [];
    
    if (fs.existsSync(userFilePath)) {
      try {
        userDrafts = JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
        // Ensure it's an array
        if (!Array.isArray(userDrafts)) {
          userDrafts = [];
        }
      } catch (error) {
        console.error('Error reading user drafts:', error);
        userDrafts = [];
      }
    }
    
    // Add new draft at the beginning of the array (newest first)
    userDrafts.unshift(draftData);
    
    // Store updated drafts
    fs.writeFileSync(userFilePath, JSON.stringify(userDrafts, null, 2));
    
    return { 
      success: true, 
      tx_hash: draftData.tx_hash,
      draft_id: draftId
    };
  }
  
  // Retrieve all drafts for a user
  retrieveDrafts(userAddress) {
    const userFilePath = path.join(this.storageDir, \`\${userAddress}.json\`);
    
    try {
      if (fs.existsSync(userFilePath)) {
        const drafts = JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
        
        // Ensure it's an array
        if (!Array.isArray(drafts) || drafts.length === 0) {
          return {
            found: false,
            drafts: []
          };
        }
        
        return {
          found: true,
          drafts: drafts.map(draft => ({
            id: draft.id,
            content: draft.content,
            metadata: draft.metadata,
            tx_hash: draft.tx_hash
          }))
        };
      }
      
      return {
        found: false,
        drafts: []
      };
    } catch (error) {
      console.error('Error in mock retrieval:', error);
      throw error;
    }
  }
  
  // Retrieve a single draft (backward compatibility)
  retrieveDraft(userAddress) {
    try {
      const result = this.retrieveDrafts(userAddress);
      if (result.found && result.drafts.length > 0) {
        // Return the most recent draft for backward compatibility
        const latestDraft = result.drafts[0];
        return {
          found: true,
          content: latestDraft.content,
          metadata: latestDraft.metadata
        };
      }
      return {
        found: false,
        content: '',
        metadata: {}
      };
    } catch (error) {
      console.error('Error retrieving single draft:', error);
      throw error;
    }
  }
  
  // Delete a draft
  deleteDraft(userAddress, draftId) {
    const userFilePath = path.join(this.storageDir, \`\${userAddress}.json\`);
    
    try {
      if (fs.existsSync(userFilePath)) {
        let drafts = JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
        
        // Filter out the draft to delete
        const filteredDrafts = drafts.filter(draft => draft.id !== draftId);
        
        // Save the filtered drafts
        fs.writeFileSync(userFilePath, JSON.stringify(filteredDrafts, null, 2));
        
        return {
          success: true,
          deleted: drafts.length !== filteredDrafts.length
        };
      }
      
      return {
        success: false,
        error: 'No drafts found for this user'
      };
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }
}

module.exports = new MockStorage();`
  );
  console.log("Created mock_service.js");
}

const mockStorage = require('./mock_service.js');

const app = express();
const port = process.env.PORT || 5001;
const USE_MOCK_FALLBACK = true; // Set to false if you want to disable mock fallback
const MAX_GENERATION_TIME = 120000; // 120 seconds timeout

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Improved error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Helper function to run Python script with timeout
const runPythonScript = (scriptName, args) => {
  return new Promise((resolve, reject) => {
    // Adjust the path to your Python environment and script
    const pythonProcess = spawn('python', [
      path.join(__dirname, scriptName),
      ...args
    ]);
    
    let result = '';
    let error = '';
    let isResolved = false;

    // Set a timeout
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        console.log(`Python process timed out after ${MAX_GENERATION_TIME / 1000} seconds`);
        pythonProcess.kill();
        reject(new Error(`Operation timed out after ${MAX_GENERATION_TIME / 1000} seconds`));
      }
    }, MAX_GENERATION_TIME);

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      
      if (isResolved) return;
      isResolved = true;
      
      console.log(`Python process exited with code ${code}`);
      
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${error}`));
      } else {
        try {
          // Try to parse as JSON
          const parsedResult = JSON.parse(result);
          resolve(parsedResult);
        } catch (e) {
          console.error('Failed to parse Python output as JSON:', e);
          console.error('Raw output:', result);
          reject(new Error(`Failed to parse Python output: ${e.message}`));
        }
      }
    });
  });
};

// Generate content endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, user_address, system_instruction } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Pass the request to Python
    const data = {
      prompt,
      user_address: user_address || 'dev_mode_address',
      system_instruction
    };
    
    const result = await runPythonScript('mock_bridge.py', ['generate', JSON.stringify(data)]);
    
    res.json(result);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: error.message || 'Failed to generate content' });
  }
});

// Enhance content endpoint
app.post('/api/enhance', async (req, res) => {
  try {
    const { draft_text, enhancement_type, user_address } = req.body;
    
    if (!draft_text) {
      return res.status(400).json({ error: 'Draft text is required' });
    }
    
    if (!enhancement_type) {
      return res.status(400).json({ error: 'Enhancement type is required' });
    }
    
    // Pass the request to Python
    const data = {
      draft_text,
      enhancement_type,
      user_address: user_address || 'dev_mode_address'
    };
    
    const result = await runPythonScript('mock_bridge.py', ['enhance', JSON.stringify(data)]);
    
    res.json(result);
  } catch (error) {
    console.error('Error enhancing content:', error);
    res.status(500).json({ error: error.message || 'Failed to enhance content' });
  }
});

// Store draft on blockchain endpoint
app.post('/api/store-draft', async (req, res) => {
  try {
    const { content, user_address, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    if (!user_address) {
      return res.status(400).json({ error: 'User address is required' });
    }
    
    console.log('Storing draft for address:', user_address);
    
    // Always store in mock storage first to ensure consistency
    const mockResult = mockStorage.storeDraft(user_address, content, metadata);
    
    try {
      // Also try blockchain storage if available
      const data = {
        content,
        user_address,
        metadata: metadata || {}
      };
      
      const blockchainResult = await runPythonScript('mock_bridge.py', ['store', JSON.stringify(data)]);
      console.log('Store result (blockchain):', blockchainResult);
      
      // Return a combined result
      res.json({
        ...mockResult,
        blockchain_tx: blockchainResult.mock ? null : blockchainResult.tx_hash
      });
    } catch (error) {
      // If blockchain fails, still return the mock result
      console.log('Blockchain storage failed, using mock storage only');
      res.json(mockResult);
    }
  } catch (error) {
    console.error('Error storing draft:', error);
    res.status(500).json({ error: error.message || 'Failed to store draft' });
  }
});

// Retrieve draft from blockchain endpoint
app.post('/api/retrieve-draft', async (req, res) => {
  try {
    const { user_address } = req.body;
    
    if (!user_address) {
      return res.status(400).json({ error: 'User address is required' });
    }
    
    console.log('Retrieving draft for address:', user_address);
    
    try {
      // Try blockchain retrieval first
      const data = {
        user_address
      };
      
      const result = await runPythonScript('mock_bridge.py', ['retrieve', JSON.stringify(data)]);
      console.log('Retrieve result:', result);
      
      res.json(result);
    } catch (error) {
      // Fall back to mock storage if blockchain fails
      if (USE_MOCK_FALLBACK) {
        console.log('Falling back to mock storage');
        const mockResult = mockStorage.retrieveDraft(user_address);
        res.json(mockResult);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error retrieving draft:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve draft' });
  }
});

// Retrieve all drafts endpoint
app.post('/api/retrieve-all-drafts', async (req, res) => {
  try {
    const { user_address } = req.body;
    
    if (!user_address) {
      return res.status(400).json({ error: 'User address is required' });
    }
    
    console.log('Retrieving all drafts for address:', user_address);
    
    try {
      // Try blockchain retrieval first
      // Note: Your actual blockchain implementation might need to be updated to support multiple drafts
      
      // For now, fall back to mock storage which supports multiple drafts
      if (USE_MOCK_FALLBACK) {
        console.log('Using mock storage for multiple drafts');
        const mockResult = mockStorage.retrieveDrafts(user_address);
        res.json(mockResult);
      } else {
        // This would be your blockchain implementation for multiple drafts
        throw new Error('Multiple drafts not implemented for blockchain yet');
      }
    } catch (error) {
      // Fall back to mock storage
      console.log('Falling back to mock storage for multiple drafts');
      const mockResult = mockStorage.retrieveDrafts(user_address);
      res.json(mockResult);
    }
  } catch (error) {
    console.error('Error retrieving drafts:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve drafts' });
  }
});

// Delete draft endpoint
app.post('/api/delete-draft', async (req, res) => {
  try {
    const { user_address, draft_id } = req.body;
    
    if (!user_address) {
      return res.status(400).json({ error: 'User address is required' });
    }
    
    if (!draft_id) {
      return res.status(400).json({ error: 'Draft ID is required' });
    }
    
    console.log('Deleting draft for address:', user_address, 'Draft ID:', draft_id);
    
    // For now, just use mock storage
    const result = mockStorage.deleteDraft(user_address, draft_id);
    res.json(result);
    
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({ error: error.message || 'Failed to delete draft' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: process.env.DEV_MODE ? 'development' : 'production' });
});

// Start server
app.listen(port, () => {
  console.log(`Secret AI Writer API running on port ${port}`);
});