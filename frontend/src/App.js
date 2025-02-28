import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// API URL - adjust if your backend runs on a different port
const API_URL = 'http://localhost:5001/api';

// Timeout constants (in milliseconds)
const GENERATE_TIMEOUT = 180000; // 3 minutes
const ENHANCE_TIMEOUT = 120000;  // 2 minutes

// Enhancement types
const enhancementTypes = [
  { id: 'grammar', label: 'Grammar & Spelling' },
  { id: 'creativity', label: 'Make More Creative' },
  { id: 'conciseness', label: 'Make More Concise' },
  { id: 'professional', label: 'Professional Tone' },
  { id: 'casual', label: 'Casual & Conversational' },
];

// Mock functions to use as fallbacks when API calls fail
const mockStoreDraft = (content, metadata) => {
  // Store in localStorage as a simple fallback
  const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  const draftData = {
    id: draftId,
    content,
    metadata: {
      ...metadata,
      timestamp: Date.now(),
      title: metadata.title || `Draft ${new Date().toLocaleString()}`
    },
    tx_hash: `mock_tx_${Math.random().toString(36).substring(2, 15)}`
  };
  
  try {
    // Get existing drafts
    let existingDrafts = [];
    try {
      const storedDrafts = localStorage.getItem('mockDrafts');
      if (storedDrafts) {
        existingDrafts = JSON.parse(storedDrafts);
        if (!Array.isArray(existingDrafts)) {
          existingDrafts = [];
        }
      }
    } catch (e) {
      console.error('Error parsing stored drafts:', e);
      existingDrafts = [];
    }
    
    // Add new draft at the beginning (newest first)
    existingDrafts.unshift(draftData);
    
    // Save updated drafts
    localStorage.setItem('mockDrafts', JSON.stringify(existingDrafts));
    
    return { 
      success: true, 
      tx_hash: draftData.tx_hash,
      draft_id: draftId
    };
  } catch (error) {
    console.error('Error in mock storage:', error);
    throw error;
  }
};

const mockRetrieveDrafts = () => {
  try {
    const storedData = localStorage.getItem('mockDrafts');
    if (storedData) {
      const drafts = JSON.parse(storedData);
      if (Array.isArray(drafts) && drafts.length > 0) {
        return {
          found: true,
          drafts: drafts
        };
      }
    }
    return { found: false, drafts: [] };
  } catch (error) {
    console.error('Error in mock drafts retrieval:', error);
    return { found: false, drafts: [] };
  }
};

const mockRetrieveDraft = () => {
  try {
    const result = mockRetrieveDrafts();
    if (result.found && result.drafts.length > 0) {
      // Return the most recent draft
      return {
        found: true,
        content: result.drafts[0].content,
        metadata: result.drafts[0].metadata
      };
    }
    return { found: false, content: '', metadata: {} };
  } catch (error) {
    console.error('Error in mock retrieval:', error);
    throw error;
  }
};

// Create a timeout promise to race against fetch operations
const timeoutPromise = (ms, message) => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
};

// Main App component
function App() {
  // Content and prompt states
  const [content, setContent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  
  // UI state
  const [activeTab, setActiveTab] = useState('generate');
  const [activeSideTab, setActiveSideTab] = useState('howItWorks');
  const [selectedEnhancement, setSelectedEnhancement] = useState(enhancementTypes[0].id);
  
  // Loading and error states
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Progress message for long operations
  const [progressMessage, setProgressMessage] = useState('');
  
  // Wallet states
  const [walletAddress, setWalletAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Metadata state
  const [metadata, setMetadata] = useState(null);
  
  // Draft retrieval states
  const [storedDrafts, setStoredDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftError, setDraftError] = useState('');
  
  // Export/import state
  const [exportFormat, setExportFormat] = useState('json');
  const [importError, setImportError] = useState('');
  
  // File input ref for import
  const fileInputRef = useRef(null);
  
  // Refs for timers
  const progressTimerRef = useRef(null);
  const longProgressTimerRef = useRef(null);
  
  // Helper function to handle API response
  const handleResponse = async (response) => {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    throw new Error('Received non-JSON response from server');
  };
  
  // Function to fetch all drafts
  const fetchAllDrafts = useCallback(async () => {
    if (!isConnected || !walletAddress) return;
    
    setLoadingDrafts(true);
    setDraftError('');
    
    try {
      const response = await fetch(`${API_URL}/retrieve-all-drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_address: walletAddress
        }),
      });
      
      let data;
      try {
        data = await handleResponse(response);
      } catch (error) {
        console.error('Error parsing response:', error);
        // Fall back to mock data
        data = mockRetrieveDrafts();
        console.log('Using mock drafts data:', data);
      }
      
      if (data.found && data.drafts && data.drafts.length > 0) {
        // Process all drafts
        const processedDrafts = data.drafts.map(draft => ({
          id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          content: draft.content || '',
          title: draft.metadata?.title || new Date(draft.metadata?.timestamp || Date.now()).toLocaleString(),
          timestamp: draft.metadata?.timestamp || Date.now(),
          wordCount: typeof draft.content === 'string' 
            ? (draft.content || '').split(/\s+/).filter(Boolean).length
            : 0
        }));
        setStoredDrafts(processedDrafts);
      } else {
        setStoredDrafts([]);
      }
      
    } catch (error) {
      console.error('Error retrieving drafts:', error);
      setDraftError('Error retrieving drafts. Using local storage as fallback.');
      
      // Try to use mockRetrieveDrafts as fallback
      try {
        const mockData = mockRetrieveDrafts();
        if (mockData.found && mockData.drafts && mockData.drafts.length > 0) {
          const processedDrafts = mockData.drafts.map(draft => ({
            id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            content: draft.content || '',
            title: draft.metadata?.title || new Date(draft.metadata?.timestamp || Date.now()).toLocaleString(),
            timestamp: draft.metadata?.timestamp || Date.now(),
            wordCount: typeof draft.content === 'string' 
              ? (draft.content || '').split(/\s+/).filter(Boolean).length
              : 0
          }));
          setStoredDrafts(processedDrafts);
        } else {
          setStoredDrafts([]);
        }
      } catch (mockError) {
        console.error('Mock retrieval also failed:', mockError);
        setStoredDrafts([]);
      }
    } finally {
      setLoadingDrafts(false);
    }
  }, [isConnected, walletAddress]); 
  
  // Fetch drafts when wallet is connected
  useEffect(() => {
    if (isConnected && walletAddress) {
      fetchAllDrafts();
    }
  }, [isConnected, walletAddress, fetchAllDrafts]);
  
  // Clean up any timers on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      if (longProgressTimerRef.current) clearTimeout(longProgressTimerRef.current);
    };
  }, []);
  
  // Add CSS for the spinner to the document
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .loading-spinner {
        display: inline-block;
        width: 1.5rem;
        height: 1.5rem;
        border: 0.2rem solid rgba(156, 163, 175, 0.3);
        border-radius: 50%;
        border-top-color: var(--secret-purple);
        animation: spin 1s linear infinite;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const loadDraft = (draft) => {
    if (draft && draft.content) {
      setContent(draft.content);
      if (draft.title) {
        setDraftTitle(draft.title);
      }
    }
  };
  
  const deleteDraft = async (draftId) => {
    if (!isConnected || !walletAddress) return;
    
    try {
      const response = await fetch(`${API_URL}/delete-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_address: walletAddress,
          draft_id: draftId
        }),
      });
      
      await handleResponse(response);
      
      // Refresh drafts list
      fetchAllDrafts();
    } catch (error) {
      console.error('Error deleting draft:', error);
      
      // Fallback: delete from local list
      setStoredDrafts(prevDrafts => prevDrafts.filter(draft => draft.id !== draftId));
      
      // Also update localStorage if using mock
      try {
        const mockData = mockRetrieveDrafts();
        if (mockData.found) {
          const updatedDrafts = mockData.drafts.filter(draft => draft.id !== draftId);
          localStorage.setItem('mockDrafts', JSON.stringify(updatedDrafts));
        }
      } catch (e) {
        console.error('Error updating mock storage:', e);
      }
    }
  };
  
  const connectWallet = async () => {
    // Check if Keplr is installed
    if (!window.keplr) {
      alert("Please install Keplr extension");
      return;
    }

    try {
      // Request connection to Keplr
      await window.keplr.enable("pulsar-3"); // Use "secret-4" for mainnet
      
      // Get the signer for Secret Network
      const offlineSigner = window.keplr.getOfflineSigner("pulsar-3");
      
      // Get the user's address
      const accounts = await offlineSigner.getAccounts();
      const address = accounts[0].address;
      
      // Update state
      setWalletAddress(address);
      setIsConnected(true);
      
      console.log("Connected to wallet:", address);
    } catch (error) {
      console.error("Error connecting to Keplr:", error);
      alert("Failed to connect wallet: " + error.message);
    }
  };

  const handleGenerateContent = async (e) => {
    e.preventDefault();
    if (!prompt || !prompt.trim()) return;
    
    setIsGenerating(true);
    setError('');
    setProgressMessage('');
    
    // Clear any existing timers
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    if (longProgressTimerRef.current) clearTimeout(longProgressTimerRef.current);
    
    // Set up progress message timers
    progressTimerRef.current = setTimeout(() => {
      setProgressMessage('This might take a little while. Still working...');
    }, 5000);
    
    longProgressTimerRef.current = setTimeout(() => {
      setProgressMessage('This is taking longer than expected. Please be patient...');
    }, 20000);
    
    try {
      // Race between fetch and timeout
      const result = await Promise.race([
        (async () => {
          // Make API call to backend
          const response = await fetch(`${API_URL}/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
              user_address: walletAddress || 'dev_mode_address',
              system_instruction: null
            }),
          });
          
          return await handleResponse(response);
        })(),
        timeoutPromise(GENERATE_TIMEOUT, 'Content generation timed out. Try a shorter prompt or try again later.')
      ]);
      
      setContent(result.content || '');
      setMetadata(result.metadata || null);
      
      // Generate a title based on the prompt
      const titlePreview = prompt.split(' ').slice(0, 5).join(' ') + '...';
      setDraftTitle(`Draft: ${titlePreview}`);
      
    } catch (error) {
      console.error('Error generating content:', error);
      setError(error.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
      setProgressMessage('');
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      if (longProgressTimerRef.current) clearTimeout(longProgressTimerRef.current);
    }
  };
  
  const handleEnhanceContent = async (e) => {
    e.preventDefault();
    if (!content || !content.trim() || !selectedEnhancement) return;
    
    setIsGenerating(true);
    setError('');
    setProgressMessage('');
    
    // Clear any existing timers
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    if (longProgressTimerRef.current) clearTimeout(longProgressTimerRef.current);
    
    // Set up progress message timers
    progressTimerRef.current = setTimeout(() => {
      setProgressMessage('Enhancing your content. Please wait...');
    }, 5000);
    
    longProgressTimerRef.current = setTimeout(() => {
      setProgressMessage('Still enhancing. This might take a bit longer...');
    }, 20000);
    
    try {
      // Race between fetch and timeout
      const result = await Promise.race([
        (async () => {
          // Make API call to backend
          const response = await fetch(`${API_URL}/enhance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              draft_text: content,
              enhancement_type: selectedEnhancement,
              user_address: walletAddress || 'dev_mode_address'
            }),
          });
          
          return await handleResponse(response);
        })(),
        timeoutPromise(ENHANCE_TIMEOUT, 'Enhancement timed out. Try a shorter text or try again later.')
      ]);
      
      setContent(result.content || '');
      setMetadata(result.metadata || null);
      
      // Update title if not set
      if (!draftTitle) {
        setDraftTitle(`Enhanced Draft (${enhancementTypes.find(t => t.id === selectedEnhancement)?.label || selectedEnhancement})`);
      }
      
    } catch (error) {
      console.error('Error enhancing content:', error);
      setError(error.message || 'Failed to enhance content');
    } finally {
      setIsGenerating(false);
      setProgressMessage('');
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      if (longProgressTimerRef.current) clearTimeout(longProgressTimerRef.current);
    }
  };

  const handleSaveDraft = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (!content || !content.trim()) {
      return;
    }
    
    setSaving(true);
    setError('');
    
    // Use draft title or generate one if empty
    const finalTitle = draftTitle || `Draft ${new Date().toLocaleString()}`;
    
    try {
      // Call the backend to store on blockchain
      const response = await fetch(`${API_URL}/store-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          user_address: walletAddress,
          metadata: {
            ...(metadata || {}),
            timestamp: Date.now(),
            content_type: 'text',
            word_count: content.split(/\s+/).filter(Boolean).length,
            title: finalTitle
          }
        }),
      });
      
      try {
        // Try to parse response as JSON
        await handleResponse(response);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
        // Refresh drafts after saving
        fetchAllDrafts();
      } catch (parseError) {
        console.error('Error parsing store response:', parseError);
        
        // Fall back to mock storage
        const mockResult = mockStoreDraft(content, {
          ...(metadata || {}),
          timestamp: Date.now(),
          content_type: 'text',
          word_count: content.split(/\s+/).filter(Boolean).length,
          title: finalTitle
        });
        
        console.log('Used mock storage:', mockResult);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
        // Refresh mock drafts
        const mockData = mockRetrieveDrafts();
        if (mockData.found) {
          const processedDrafts = mockData.drafts.map(draft => ({
            id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            content: draft.content || '',
            title: draft.metadata?.title || new Date(draft.metadata?.timestamp || Date.now()).toLocaleString(),
            timestamp: draft.metadata?.timestamp || Date.now(),
            wordCount: typeof draft.content === 'string' 
              ? (draft.content || '').split(/\s+/).filter(Boolean).length
              : 0
          }));
          setStoredDrafts(processedDrafts);
        }
      }
      
    } catch (error) {
      console.error('Error saving draft:', error);
      setError('Server error. Draft saved to local storage as fallback.');
      
      // Try mock storage as fallback
      try {
        mockStoreDraft(content, {
          ...(metadata || {}),
          timestamp: Date.now(),
          content_type: 'text',
          word_count: content.split(/\s+/).filter(Boolean).length,
          title: finalTitle
        });
        
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
        // Refresh mock drafts
        const mockData = mockRetrieveDrafts();
        if (mockData.found) {
          const processedDrafts = mockData.drafts.map(draft => ({
            id: draft.id || `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            content: draft.content || '',
            title: draft.metadata?.title || new Date(draft.metadata?.timestamp || Date.now()).toLocaleString(),
            timestamp: draft.metadata?.timestamp || Date.now(),
            wordCount: typeof draft.content === 'string' 
              ? (draft.content || '').split(/\s+/).filter(Boolean).length
              : 0
          }));
          setStoredDrafts(processedDrafts);
        }
      } catch (mockError) {
        console.error('Mock storage also failed:', mockError);
        setError('Failed to save draft anywhere. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };
  
  // Export current draft to file
  const exportDraft = () => {
    if (!content || !content.trim()) {
      alert('No content to export');
      return;
    }
    
    try {
      let exportData, filename, dataType;
      
      const draftData = {
        title: draftTitle || 'Untitled Draft',
        content: content,
        metadata: metadata || {
          timestamp: Date.now(),
          word_count: content.split(/\s+/).filter(Boolean).length
        },
        exported_at: new Date().toISOString()
      };
      
      if (exportFormat === 'json') {
        exportData = JSON.stringify(draftData, null, 2);
        filename = `${draftTitle || 'draft'}-${Date.now()}.json`;
        dataType = 'application/json';
      } else if (exportFormat === 'txt') {
        exportData = `${draftTitle || 'Untitled Draft'}\n\n${content}\n\n---\nExported: ${new Date().toLocaleString()}`;
        filename = `${draftTitle || 'draft'}-${Date.now()}.txt`;
        dataType = 'text/plain';
      } else if (exportFormat === 'md') {
        exportData = `# ${draftTitle || 'Untitled Draft'}\n\n${content}\n\n---\n*Exported: ${new Date().toLocaleString()}*`;
        filename = `${draftTitle || 'draft'}-${Date.now()}.md`;
        dataType = 'text/markdown';
      }
      
      // Create a Blob and download link
      const blob = new Blob([exportData], { type: dataType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Error exporting draft:', error);
      alert('Error exporting draft: ' + error.message);
    }
  };
  
  // Import draft from file
  const importDraft = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportError('');
    
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const fileContent = event.target?.result;
          if (!fileContent) throw new Error('Failed to read file');
          
          let importedContent, importedTitle;
          
          // Check file type
          if (file.name.endsWith('.json')) {
            // JSON format
            const jsonData = JSON.parse(fileContent.toString());
            importedContent = jsonData.content || '';
            importedTitle = jsonData.title || '';
          } else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
            // Text/Markdown format - simple extraction
            const textLines = fileContent.toString().split('\n');
            importedTitle = textLines[0] || '';
            importedContent = textLines.slice(2).join('\n') || '';
          } else {
            throw new Error('Unsupported file format. Please use .json, .txt, or .md files.');
          }
          
          // Update editor with imported content
          if (importedContent) {
            setContent(importedContent);
            if (importedTitle) {
              setDraftTitle(importedTitle);
            }
          } else {
            throw new Error('Could not extract content from file');
          }
          
        } catch (error) {
          console.error('Error parsing imported file:', error);
          setImportError('Error importing file: ' + error.message);
        }
      };
      
      reader.onerror = () => {
        setImportError('Error reading file');
      };
      
      if (file.name.endsWith('.json')) {
        reader.readAsText(file);
      } else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        setImportError('Unsupported file format. Please use .json, .txt, or .md files.');
      }
      
    } catch (error) {
      console.error('Error importing file:', error);
      setImportError('Error importing file: ' + error.message);
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="app">
      <header className="header">
        <h1>Secret AI Writer</h1>
        {isConnected ? (
          <div style={{ 
            backgroundColor: 'white', 
            color: 'var(--secret-dark)',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: 'green',
              marginRight: '8px'
            }}></div>
            {walletAddress ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}` : 'Connected'}
          </div>
        ) : (
          <button className="button" onClick={connectWallet}>Connect Wallet</button>
        )}
      </header>
      
      <main className="main-container">
        <h1>Privacy-Focused AI Writing</h1>
        <p>Create content securely with AI assistance. All your drafts are encrypted and stored on the Secret Network blockchain.</p>
        
        <div className="two-column">
          <div>
            <div className="card">
              <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: '1rem' }}>
                <div style={{ display: 'flex' }}>
                  <button
                    onClick={() => setActiveTab('generate')}
                    className={`tab-button ${activeTab === 'generate' ? 'tab-active' : 'tab-inactive'}`}
                    style={{ width: '50%' }}
                  >
                    Generate New Content
                  </button>
                  <button
                    onClick={() => setActiveTab('enhance')}
                    className={`tab-button ${activeTab === 'enhance' ? 'tab-active' : 'tab-inactive'}`}
                    style={{ 
                      width: '50%',
                      opacity: !content || !content.trim() ? 0.5 : 1,
                      cursor: content && content.trim() ? 'pointer' : 'not-allowed'
                    }}
                    disabled={!content || !content.trim()}
                  >
                    Enhance Current Draft
                  </button>
                </div>
              </div>
              
              {activeTab === 'generate' ? (
                <form onSubmit={handleGenerateContent}>
                  <textarea
                    placeholder="Write a prompt for the AI..."
                    value={prompt || ''}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="editor-area"
                    style={{ minHeight: '100px' }}
                  ></textarea>
                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button 
                      type="submit" 
                      className="button"
                      disabled={isGenerating || !prompt || !prompt.trim()}
                      style={{ 
                        opacity: isGenerating || !prompt || !prompt.trim() ? 0.7 : 1,
                        cursor: isGenerating || !prompt || !prompt.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                  {isGenerating && progressMessage && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                      <div className="loading-spinner" style={{ marginRight: '0.5rem' }}></div>
                      {progressMessage}
                    </div>
                  )}
                </form>
              ) : (
                <form onSubmit={handleEnhanceContent}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 'medium' }}>
                      Select enhancement type:
                    </label>
                    <select
                      value={selectedEnhancement}
                      onChange={(e) => setSelectedEnhancement(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        border: '1px solid #D1D5DB',
                      }}
                    >
                      {enhancementTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button 
                      type="submit" 
                      className="button"
                      disabled={isGenerating || !content || !content.trim()}
                      style={{ 
                        opacity: isGenerating || !content || !content.trim() ? 0.7 : 1,
                        cursor: isGenerating || !content || !content.trim() ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isGenerating ? 'Enhancing...' : 'Enhance'}
                    </button>
                  </div>
                  {isGenerating && progressMessage && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6B7280', display: 'flex', alignItems: 'center' }}>
                      <div className="loading-spinner" style={{ marginRight: '0.5rem' }}></div>
                      {progressMessage}
                    </div>
                  )}
                </form>
              )}
              
              {error && (
                <div className="error-notification">
                  {error}
                </div>
              )}
            </div>
            
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="draft-title-container" style={{ display: 'flex', alignItems: 'center', flexGrow: 1, marginRight: '1rem' }}>
                  <input
                    type="text"
                    value={draftTitle || ''}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Draft Title"
                    className="draft-title-input"
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1.125rem',
                      padding: '0.25rem 0.5rem',
                      border: '1px solid transparent',
                      borderRadius: '0.25rem',
                      width: '100%',
                      backgroundColor: 'transparent',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#9986F0'}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                </div>
                <div className="draft-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="button" 
                    onClick={handleSaveDraft}
                    disabled={!content || !content.trim() || saving}
                    style={{ 
                      opacity: !content || !content.trim() || saving ? 0.7 : 1,
                      cursor: !content || !content.trim() || saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {saving ? 'Saving...' : '🔒 Store'}
                  </button>
                </div>
              </div>
              
              <textarea
                className="editor-area"
                value={content || ''}
                onChange={(e) => setContent(e.target.value)}
                placeholder="AI-generated content will appear here..."
              ></textarea>
              
              {saveSuccess && (
                <div className="success-notification">
                  Draft saved successfully!
                </div>
              )}
              
              {importError && (
                <div className="error-notification">
                  {importError}
                </div>
              )}
              
              <div className="export-import-controls" style={{ 
                marginTop: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div className="export-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #D1D5DB',
                    }}
                  >
                    <option value="json">JSON</option>
                    <option value="txt">Text</option>
                    <option value="md">Markdown</option>
                  </select>
                  <button 
                    type="button"
                    onClick={exportDraft}
                    disabled={!content || !content.trim()}
                    className="export-button"
                    style={{
                      backgroundColor: '#F3F4F6',
                      color: '#111827',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      cursor: content && content.trim() ? 'pointer' : 'not-allowed',
                      opacity: content && content.trim() ? 1 : 0.7,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>📤</span> Export
                  </button>
                </div>
                
                <div className="import-controls">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={importDraft}
                    accept=".json,.txt,.md"
                    style={{ display: 'none' }}
                    id="import-file"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="import-button"
                    style={{
                      backgroundColor: '#F3F4F6',
                      color: '#111827',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>📥</span> Import
                  </button>
                </div>
              </div>
              
              {metadata && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B7280' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span>Word count: {(content || '').split(/\s+/).filter(Boolean).length}</span>
                    <span>•</span>
                    <span>Model: {metadata.model || 'unknown'}</span>
                    <span>•</span>
                    <span>Processing time: {metadata.processing_time || '0'}s</span>
                    {metadata.tx_hash && (
                      <>
                        <span>•</span>
                        <span>TX: {metadata.tx_hash.substring(0, 10)}...</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <div className="card">
              <div style={{ borderBottom: '1px solid #E5E7EB', marginBottom: '1rem' }}>
                <div style={{ display: 'flex' }}>
                  <button
                    onClick={() => setActiveSideTab('howItWorks')}
                    className={`tab-button ${activeSideTab === 'howItWorks' ? 'tab-active' : 'tab-inactive'}`}
                    style={{ width: '50%' }}
                  >
                    How It Works
                  </button>
                  <button
                    onClick={() => setActiveSideTab('drafts')}
                    className={`tab-button ${activeSideTab === 'drafts' ? 'tab-active' : 'tab-inactive'}`}
                    style={{ width: '50%' }}
                  >
                    Your Drafts
                  </button>
                </div>
              </div>
              
              {activeSideTab === 'howItWorks' ? (
                <div className="how-it-works">
                  <ol>
                    <li>Connect your Keplr wallet</li>
                    <li>Write a prompt for AI</li>
                    <li>Edit your draft</li>
                    <li>Store privately on blockchain</li>
                    <li>Access your drafts anywhere</li>
                  </ol>
                  
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E5E7EB' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'medium', marginBottom: '0.5rem' }}>Features:</h3>
                    <ul style={{ paddingLeft: '1.5rem', listStyleType: 'disc' }}>
                      <li>AI-powered content generation</li>
                      <li>Multiple enhancement styles</li>
                      <li>Encrypted blockchain storage</li>
                      <li>Export/import your drafts</li>
                      <li>Privacy-first architecture</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="drafts-list">
                  {!isConnected ? (
                    <p>Connect your wallet to view stored drafts</p>
                  ) : loadingDrafts ? (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div className="loading-spinner"></div>
                      <p>Loading drafts...</p>
                    </div>
                  ) : draftError ? (
                    <div className="error-notification">
                      {draftError}
                    </div>
                  ) : storedDrafts.length > 0 ? (
                    <div className="drafts-container">
                      {storedDrafts.map((draft) => (
                        <div key={draft.id} className="draft-card" style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 'medium', fontSize: '0.875rem' }}>{draft.title}</span>
                            <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                              {new Date(draft.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                            {draft.wordCount} words
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button 
                              className="button"
                              style={{ 
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#F3F4F6', 
                                color: '#111827',
                                flexGrow: 1
                              }}
                              onClick={() => loadDraft(draft)}
                            >
                              Load
                            </button>
                            <button 
                              style={{ 
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#FEE2E2', 
                                color: '#B91C1C',
                                border: 'none',
                                borderRadius: '0.25rem',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this draft?')) {
                                  deleteDraft(draft.id);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No stored drafts found</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      <footer style={{ backgroundColor: 'var(--secret-dark)', color: 'white', padding: '1rem', marginTop: '2rem', textAlign: 'center' }}>
        <p>&copy; 2025 Secret AI Writer. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;