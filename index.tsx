/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";

// DOM element references
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const extractButton = document.getElementById('extract-button') as HTMLButtonElement;
const downloadCsvButton = document.getElementById('download-csv-button') as HTMLButtonElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const fileLabel = document.querySelector('.file-label span') as HTMLSpanElement;
const historyArea = document.querySelector('.history-area') as HTMLElement;
const historyContainer = document.getElementById('history-container') as HTMLDivElement;
const clearHistoryButton = document.getElementById('clear-history-button') as HTMLButtonElement;
const analyzeZipButton = document.getElementById('analyze-zip-button') as HTMLButtonElement;
const analyzeJsonButton = document.getElementById('analyze-json-button') as HTMLButtonElement;
const analyzeSplitButton = document.getElementById('analyze-split-button') as HTMLButtonElement;
const analyzeAiButton = document.getElementById('analyze-ai-button') as HTMLButtonElement;


// Make sure all elements exist
if (!fileInput || !extractButton || !downloadCsvButton || !responseContainer || !fileLabel || !historyArea || !historyContainer || !clearHistoryButton || !analyzeZipButton || !analyzeJsonButton || !analyzeSplitButton || !analyzeAiButton) {
  throw new Error("Required DOM elements not found.");
}

type ExtractedData = {
  lac: string;
  rat: string;
  location: string;
  tac: string;
};

type HistoryEntry = {
  timestamp: number;
  data: ExtractedData[];
};

const HISTORY_STORAGE_KEY = 'extractionHistory';
const selectedHistoryItems = new Set<number>();
const API_BASE_URL = 'http://localhost:8000';

// Update file label with the selected file name
fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    fileLabel.textContent = fileInput.files[0].name;
    // Reset view when a new file is chosen
    responseContainer.innerHTML = '';
    downloadCsvButton.classList.add('hidden');
  } else {
    fileLabel.textContent = 'Choose a .txt file';
  }
});

// Handle the extract button click
extractButton.addEventListener('click', async () => {
  if (!fileInput.files || fileInput.files.length === 0) {
    responseContainer.textContent = 'Please select a .txt file first.';
    return;
  }

  const file = fileInput.files[0];
  if (file.type !== 'text/plain') {
    responseContainer.textContent = 'Please select a valid .txt file.';
    return;
  }

  const reader = new FileReader();

  reader.onload = async (e) => {
    const fileContent = e.target?.result;
    if (typeof fileContent !== 'string') {
      responseContainer.textContent = 'Error reading file content.';
      return;
    }

    if (fileContent.trim() === '') {
      responseContainer.textContent = 'The selected file is empty. Please choose a file with content.';
      return;
    }

    // UI updates for processing state
    responseContainer.innerHTML = '<div class="loader"></div>';
    extractButton.disabled = true;
    downloadCsvButton.classList.add('hidden');

    try {
      // Artificial delay for UX to ensure the loader is visible
      await new Promise(resolve => setTimeout(resolve, 500));

      const lines = fileContent.split('\n');
      const extractedData: ExtractedData[] = [];
      // Regex to capture LAC, RAT, LOCATION, and TAC
      const extractionRegex = /-lac\s+(\d+)\s+-at\s+(\S+).*?-gan\s+([A-Z]+)_(\d+)/;

      for (const line of lines) {
        // Skip empty or whitespace-only lines from processing
        if (line.trim() === '') {
          continue;
        }
        
        const match = line.match(extractionRegex);
        if (match) {
          const record = {
            lac: match[1],
            rat: match[2],
            location: match[3],
            tac: match[4],
          };
          extractedData.push(record);
        } else {
          // Log lines that don't match the pattern for debugging
          console.log(`Line did not match pattern: "${line}"`);
        }
      }

      if (extractedData.length > 0) {
        displayDataAsTable(extractedData, responseContainer, true);
        downloadCsvButton.classList.remove('hidden');
        // Set up the download button functionality
        downloadCsvButton.onclick = () => generateCsvDownload(extractedData);
        saveExtractionToHistory(extractedData);
      } else {
        responseContainer.textContent = 'No matching LAC, RAT, LOCATION, and TAC data found in the file.';
        downloadCsvButton.classList.add('hidden');
      }
    } catch (error) {
      console.error('Parsing Error:', error);
      responseContainer.textContent = 'Sorry, an error occurred while processing the file.';
    } finally {
      // Restore UI state
      extractButton.disabled = false;
    }
  };

  reader.onerror = () => {
    responseContainer.textContent = 'Failed to read the file.';
  };

  reader.readAsText(file);
});

function displayDataAsTable(data: ExtractedData[], container: HTMLElement, isPreview: boolean = false) {
  const PREVIEW_ROW_COUNT = 5;

  // Clear previous content
  container.innerHTML = '';

  const table = document.createElement('table');

  // Create header row
  const thead = table.createTHead();
  const headerRow = thead.insertRow();
  ['LAC', 'RAT', 'LOCATION', 'TAC'].forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });

  // Create data rows
  const tbody = table.createTBody();
  data.forEach(item => {
    const row = tbody.insertRow();
    row.insertCell().textContent = item.lac;
    row.insertCell().textContent = item.rat;
    row.insertCell().textContent = item.location;
    row.insertCell().textContent = item.tac;
  });

  if (isPreview && data.length > PREVIEW_ROW_COUNT) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-preview-wrapper preview-active';

    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    tableContainer.appendChild(table);
    
    const showMoreButton = document.createElement('button');
    showMoreButton.className = 'show-more-button';
    showMoreButton.textContent = `Show all ${data.length} rows`;
    showMoreButton.setAttribute('aria-label', `Show all ${data.length} rows`);
    
    showMoreButton.onclick = () => {
      wrapper.classList.remove('preview-active');
      showMoreButton.remove();
    };

    wrapper.appendChild(tableContainer);
    wrapper.appendChild(showMoreButton);
    container.appendChild(wrapper);
  } else {
    container.appendChild(table);
  }
}

function dataToCsvString(data: ExtractedData[]): string {
  const headers = ['LAC', 'RAT', 'LOCATION', 'TAC'];
  // The key names in ExtractedData are lowercase, so map headers to them
  const dataKeys = headers.map(h => h.toLowerCase()) as (keyof ExtractedData)[];
  
  const csvRows = [
    headers.join(','), // header row
    ...data.map(row => 
      dataKeys.map(key => `"${row[key]}"`).join(',')
    )
  ];
  
  return csvRows.join('\n');
}

function generateCsvDownload(data: ExtractedData[]) {
  const csvString = dataToCsvString(data);
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.setAttribute('href', url);
  a.setAttribute('download', 'extracted_data.csv');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- History Functions ---

function getHistory(): HistoryEntry[] {
  const historyJson = localStorage.getItem(HISTORY_STORAGE_KEY);
  return historyJson ? JSON.parse(historyJson) : [];
}

function saveExtractionToHistory(data: ExtractedData[]) {
  const history = getHistory();
  const newEntry: HistoryEntry = {
    timestamp: Date.now(),
    data: data,
  };
  // Add new entry to the beginning of the array
  history.unshift(newEntry);
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  renderHistory();
}

function updateAnalyzeButtonState() {
  const disabled = selectedHistoryItems.size < 2;
  analyzeZipButton.disabled = disabled;
  analyzeJsonButton.disabled = disabled;
  analyzeSplitButton.disabled = disabled;
  analyzeAiButton.disabled = disabled;
}

function renderHistory() {
  const history = getHistory();
  historyContainer.innerHTML = '';

  if (history.length === 0) {
    historyArea.classList.add('hidden');
    return;
  }

  historyArea.classList.remove('hidden');

  history.forEach(entry => {
    const historyItem = document.createElement('details');
    historyItem.className = 'history-item';

    const summary = document.createElement('summary');
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.timestamp = String(entry.timestamp);
    checkbox.checked = selectedHistoryItems.has(entry.timestamp);
    const timestampStr = new Date(entry.timestamp).toLocaleString();
    checkbox.setAttribute('aria-label', `Select extraction from ${timestampStr} for analysis`);

    const summaryText = document.createElement('span');
    summaryText.textContent = `Extracted on ${timestampStr} (${entry.data.length} rows)`;

    summary.appendChild(checkbox);
    summary.appendChild(summaryText);

    const content = document.createElement('div');
    content.className = 'history-item-content';

    const tableContainer = document.createElement('div');
    displayDataAsTable(entry.data, tableContainer, true);

    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download CSV';
    downloadButton.onclick = () => generateCsvDownload(entry.data);

    content.appendChild(tableContainer);
    content.appendChild(downloadButton);
    historyItem.appendChild(summary);
    historyItem.appendChild(content);

    historyContainer.appendChild(historyItem);
  });
  updateAnalyzeButtonState();
}

historyContainer.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.type === 'checkbox' && target.dataset.timestamp) {
    const timestamp = Number(target.dataset.timestamp);
    if (target.checked) {
      selectedHistoryItems.add(timestamp);
    } else {
      selectedHistoryItems.delete(timestamp);
    }
    updateAnalyzeButtonState();
  }
});

clearHistoryButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all extraction history? This cannot be undone.')) {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    selectedHistoryItems.clear();
    renderHistory();
  }
});

async function handleApiError(response: Response): Promise<never> {
  const errorText = await response.text();
  try {
    const errorJson = JSON.parse(errorText);
    throw new Error(`Server responded with status ${response.status}:\n${JSON.stringify(errorJson, null, 2)}`);
  } catch (e) {
    throw new Error(`Server responded with status ${response.status}: ${errorText || 'An unknown error occurred'}`);
  }
}

async function downloadSplitFile(downloadUrl: string, sourceFile: string) {
  try {
    const response = await fetch(`${API_BASE_URL}${downloadUrl}`);
    if (!response.ok) {
        await handleApiError(response);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unique_rows_${sourceFile}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(`Failed to download split file ${sourceFile}:`, error);
    alert(`Could not download the file for ${sourceFile}. See console for details.`);
  }
}

async function performAnalysis(endpoint: string, analysisType: 'zip' | 'json' | 'split') {
  if (selectedHistoryItems.size < 2) {
    alert('Please select at least two history items to analyze.');
    return;
  }
  
  const allHistory = getHistory();
  const selectedData = allHistory.filter(entry => selectedHistoryItems.has(entry.timestamp));
  
  const formData = new FormData();
  selectedData.forEach(entry => {
    const csvString = dataToCsvString(entry.data);
    const csvBlob = new Blob([csvString], { type: 'text/csv' });
    const fileName = `extraction_${entry.timestamp}.csv`;
    formData.append('files', csvBlob, fileName);
  });

  // Set loading state
  responseContainer.innerHTML = '<div class="loader"></div>';
  extractButton.disabled = true;
  clearHistoryButton.disabled = true;
  analyzeZipButton.disabled = true;
  analyzeJsonButton.disabled = true;
  analyzeSplitButton.disabled = true;
  analyzeAiButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      await handleApiError(response);
    }
    
    // Handle response based on the analysis type
    if (analysisType === 'zip') {
      const zipBlob = await response.blob();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analysis_results.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      responseContainer.innerHTML = `<h3>Analysis Complete</h3><p>Your analysis results have been downloaded as "analysis_results.zip".</p>`;
    } else if (analysisType === 'json') {
      const jsonData = await response.json();
      const jsonString = JSON.stringify(jsonData, null, 2);
      
      const downloadJsonButton = document.createElement('button');
      downloadJsonButton.textContent = 'Download JSON';
      downloadJsonButton.onclick = () => {
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'analysis_results.json';
          a.click();
          URL.revokeObjectURL(url);
      };

      responseContainer.innerHTML = `<h3>JSON Analysis Results</h3>`;
      responseContainer.appendChild(downloadJsonButton);
      const pre = document.createElement('pre');
      pre.textContent = jsonString;
      responseContainer.appendChild(pre);
    } else if (analysisType === 'split') {
        const splitData = await response.json();
        responseContainer.innerHTML = `<h3>Split Analysis Results</h3><p>${splitData.message}</p>`;

        const summary = splitData.summary;
        if (summary) {
            const summaryDiv = document.createElement('div');
            summaryDiv.innerHTML = `<p><strong>Files Processed:</strong> ${summary.total_files_processed} | <strong>Total Rows:</strong> ${summary.total_rows} | <strong>Total Unique Rows:</strong> ${summary.total_unique_rows}</p>`;
            responseContainer.appendChild(summaryDiv);
        }

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'split-results-container';

        splitData.result_files.forEach((file: { source: string; download_url: string }) => {
            const item = document.createElement('div');
            item.className = 'split-result-item';

            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = `Unique rows for ${file.source}`;
            
            const downloadButton = document.createElement('button');
            downloadButton.textContent = `Download CSV`;
            downloadButton.onclick = () => downloadSplitFile(file.download_url, file.source);
            
            item.appendChild(fileNameSpan);
            item.appendChild(downloadButton);
            resultsContainer.appendChild(item);
        });
        responseContainer.appendChild(resultsContainer);
    }

  } catch (error) {
    console.error('Analysis API Error:', error);
    let friendlyMessage = 'An unknown error occurred during analysis.';

    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      friendlyMessage = `Could not connect to the analysis server.\n\nPlease ensure the backend server is running at ${API_BASE_URL} and is accessible from your browser.`;
    } else if (error instanceof Error) {
        if (error.message.includes('Object of type int64 is not JSON serializable')) {
            friendlyMessage = `The analysis server encountered an internal data formatting error.\n\n` +
                              `Error Details: ${error.message}\n\n` +
                              `This is a known issue within the backend Python server. It occurs when the server processes numeric data (like LAC or TAC) and fails to convert it into a standard JSON format for the response.\n\n` +
                              `What you can do:\n` +
                              `1. Report this bug for the backend API to be fixed.\n` +
                              `2. As a workaround, try using the "Download ZIP" or "Split Results" analysis types, as they may not be affected by this specific JSON conversion issue.`;
        } 
        else if (error.message.includes('Server responded with status 400') || error.message.includes('Server responded with status 422')) {
             friendlyMessage = `The server rejected the request due to invalid data.\n\n` +
                              `Server Message:\n${error.message}\n\n` +
                              `Please verify the following:\n` +
                              `• Ensure the selected files are not empty.\n` +
                              `• Check that all selected files have consistent column headers (LAC, RAT, LOCATION, TAC).\n` +
                              `• The server may have other specific data requirements not met by the selection.`;
        } else {
            friendlyMessage = error.message;
        }
    }
    responseContainer.innerHTML = `<h3>Analysis Error</h3><pre class="error-message">${friendlyMessage}</pre>`;
  } finally {
    extractButton.disabled = false;
    clearHistoryButton.disabled = false;
    updateAnalyzeButtonState();
  }
}

async function performAiAnalysis() {
  if (selectedHistoryItems.size < 2) {
    alert('Please select at least two history items to analyze with AI.');
    return;
  }

  const allHistory = getHistory();
  const selectedData = allHistory.filter(entry => selectedHistoryItems.has(entry.timestamp));

  // Set loading state
  responseContainer.innerHTML = '<div class="loader"></div>';
  extractButton.disabled = true;
  clearHistoryButton.disabled = true;
  analyzeZipButton.disabled = true;
  analyzeJsonButton.disabled = true;
  analyzeSplitButton.disabled = true;
  analyzeAiButton.disabled = true;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const promptParts: string[] = [
      'You are a data analyst. You will be provided with several datasets in CSV format, each from a different file.',
      'Your task is to analyze these datasets and identify any rows that are present in some files but are missing in others.',
      'These datasets are expected to be very similar, so any differences are significant and should be highlighted.',
      'List the unique or missing rows and clearly specify which file(s) they were found in and which file(s) they were missing from.',
      'The columns are LAC, RAT, LOCATION, TAC.',
      'Format your output clearly for easy reading. Here are the datasets:\n'
    ];

    selectedData.forEach(entry => {
      const fileName = `extraction_${entry.timestamp}.csv`;
      const csvString = dataToCsvString(entry.data);
      promptParts.push(`--- START OF FILE: ${fileName} ---\n${csvString}\n--- END OF FILE: ${fileName} ---\n`);
    });
    
    const fullPrompt = promptParts.join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    const aiResponseText = response.text;

    responseContainer.innerHTML = `<h3>AI Analysis: Discrepancies Found</h3><pre class="ai-response">${aiResponseText}</pre>`;

  } catch (error) {
    console.error('AI Analysis Error:', error);
    let errorMessage = 'An error occurred while communicating with the AI model. Please check the console for details.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    responseContainer.innerHTML = `<h3>AI Analysis Error</h3><pre class="error-message">${errorMessage}</pre>`;
  } finally {
    extractButton.disabled = false;
    clearHistoryButton.disabled = false;
    updateAnalyzeButtonState();
  }
}

analyzeZipButton.addEventListener('click', () => performAnalysis('/analyze-csv-files/', 'zip'));
analyzeJsonButton.addEventListener('click', () => performAnalysis('/analyze-csv-files/with-json/', 'json'));
analyzeSplitButton.addEventListener('click', () => performAnalysis('/analyze-csv-files/split/', 'split'));
analyzeAiButton.addEventListener('click', performAiAnalysis);


// Initial render of history on page load
document.addEventListener('DOMContentLoaded', renderHistory);