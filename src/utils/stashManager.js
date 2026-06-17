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
 * @param {string|null} groupId Group ID for categorized stashing (e.g. meals). Null for general bucket.
 * @returns {Promise<Object>} The stashed item metadata
 */
export async function stashFile(file, groupId = null) {
  const id = 'stash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  
  // Read file as ArrayBuffer to ensure safe storage across browsers
  const arrayBuffer = await file.arrayBuffer();
  
  const stashItem = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    timestamp: Date.now(),
    groupId, // null means "散件区" (Misc)
    data: arrayBuffer
  };
  
  await localforage.setItem(id, stashItem);
  return { id, name: file.name, size: file.size, timestamp: stashItem.timestamp, groupId };
}

/**
 * Create an empty group.
 * @param {string} groupName 
 * @returns {Promise<Object>}
 */
export async function createStashGroup(groupName) {
  const groupId = Date.now().toString();
  const stashItem = {
    id: 'groupdef_' + groupId,
    name: groupName,
    type: 'group_definition',
    timestamp: Date.now(),
    groupId: groupId, // The ID of the group
    data: null // No file data
  };
  await localforage.setItem(stashItem.id, stashItem);
  return stashItem;
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
      type: value.type,
      size: value.size,
      timestamp: value.timestamp,
      groupId: value.groupId || null
    });
  });
  return metadataList.sort((a, b) => a.timestamp - b.timestamp); // Sort chronological
}

/**
 * Remove a file from the stash by ID.
 * @param {string} id 
 */
export async function removeStashItem(id) {
  await localforage.removeItem(id);
}

/**
 * Remove an entire group and all its items.
 * @param {string} groupId 
 */
export async function removeStashGroup(groupId) {
  const keysToRemove = [];
  await localforage.iterate((value, key) => {
    if (value.groupId === groupId || (value.type === 'group_definition' && value.groupId === groupId)) {
      keysToRemove.push(key);
    }
  });
  for (const key of keysToRemove) {
    await localforage.removeItem(key);
  }
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
  
  // First, gather all group definitions
  const groupNames = {};
  await localforage.iterate((value) => {
    if (value.type === 'group_definition') {
      groupNames[value.groupId] = value.name;
    }
  });
  
  await localforage.iterate((value) => {
    if (value.type === 'group_definition') return; // Skip the metadata entries
    if (!value.data) return; // Paranoia check
    
    // If it has a groupId, put it in a folder "Group_<groupId>/"
    // Otherwise put it in "Misc/"
    let folderName = '散件区/';
    if (value.groupId) {
      const gName = groupNames[value.groupId] || value.groupId;
      // Sanitize folder name
      const safeName = gName.replace(/[\/\\]/g, '_');
      folderName = `专项组_${safeName}/`;
    }
    
    zip.file(folderName + value.name, value.data);
    count++;
  });
  
  if (count === 0) {
    throw new Error('暂存区为空，没有可以打包的文件');
  }
  
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `手机发票暂存包裹_${new Date().getTime()}.zip`);
  return count;
}
