// mock_service.js - Multiple drafts support
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
    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create draft object with current timestamp
    const draftData = {
      id: draftId,
      content,
      metadata: {
        ...metadata,
        timestamp: Date.now(),  // Use current time in milliseconds
        title: metadata.title || `Draft ${new Date().toLocaleString()}`
      },
      tx_hash: `mock_tx_${Math.random().toString(36).substring(2, 15)}`
    };
    
    // Get or create user drafts file
    const userFilePath = path.join(this.storageDir, `${userAddress}.json`);
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
    const userFilePath = path.join(this.storageDir, `${userAddress}.json`);
    
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
    const userFilePath = path.join(this.storageDir, `${userAddress}.json`);
    
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

module.exports = new MockStorage();