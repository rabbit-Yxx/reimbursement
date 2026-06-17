import localforage from 'localforage';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Configure localforage to use IndexedDB
localforage.config({
  name: 'ReimbursementTool',
  storeName: 'stash_files'
});

/**
 * Save a file to the stash.
 * @param {File} file 
 * @returns {Promise<Object>} The stashed item metadata
 */
export async function stashFile(file) {
  const id = 'stash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  
  // Read file as ArrayBuffer to ensure safe storage across browsers
  const arrayBuffer = await file.arrayBuffer();
  
  const stashItem = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    timestamp: Date.now(),
    data: arrayBuffer
  };
  
  await localforage.setItem(id, stashItem);
  return { id, name: file.name, size: file.size, timestamp: stashItem.timestamp };
}

/**
 * Get all metadata for stashed files (without loading the full file data).
 * @returns {Promise<Array>} List of stash metadata
 */
export async function getStashMetadata() {
  const metadataList = [];
  await localforage.iterate((value, key) => {
    metadataList.push({
      id: key,
      name: value.name,
      size: value.size,
      timestamp: value.timestamp
    });
  });
  return metadataList.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Remove a file from the stash by ID.
 * @param {string} id 
 */
export async function removeStashItem(id) {
  await localforage.removeItem(id);
}

/**
 * Clear the entire stash.
 */
export async function clearStash() {
  await localforage.clear();
}

/**
 * Pack all stashed files into a ZIP and trigger download.
 */
export async function exportStashAsZip() {
  const zip = new JSZip();
  let count = 0;
  
  await localforage.iterate((value) => {
    // value.data is an ArrayBuffer
    zip.file(value.name, value.data);
    count++;
  });
  
  if (count === 0) {
    throw new Error('暂存区为空，没有可以打包的文件');
  }
  
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `手机发票暂存包裹_${new Date().getTime()}.zip`);
  return count;
}
