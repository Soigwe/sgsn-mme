/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// DOM element references
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const extractButton = document.getElementById('extract-button') as HTMLButtonElement;
const downloadCsvButton = document.getElementById('download-csv-button') as HTMLButtonElement;
const responseContainer = document.getElementById('response-container') as HTMLDivElement;
const fileLabel = document.querySelector('.file-label span') as HTMLSpanElement;

// Make sure all elements exist
if (!fileInput || !extractButton || !downloadCsvButton || !responseContainer || !fileLabel) {
  throw new Error("Required DOM elements not found.");
}

type ExtractedData = {
  lac: string;
  rat: string;
  location: string;
  tac: string;
};

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
        displayDataAsTable(extractedData);
        downloadCsvButton.classList.remove('hidden');
        // Set up the download button functionality
        downloadCsvButton.onclick = () => generateCsv(extractedData);
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

function displayDataAsTable(data: ExtractedData[]) {
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

  // Clear previous content and append the new table
  responseContainer.innerHTML = '';
  responseContainer.appendChild(table);
}

function generateCsv(data: ExtractedData[]) {
  const headers = ['LAC', 'RAT', 'LOCATION', 'TAC'];
  // The key names in ExtractedData are lowercase, so map headers to them
  const dataKeys = headers.map(h => h.toLowerCase()) as (keyof ExtractedData)[];
  
  const csvRows = [
    headers.join(','), // header row
    ...data.map(row => 
      dataKeys.map(key => `"${row[key]}"`).join(',')
    )
  ];
  
  const csvString = csvRows.join('\n');
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