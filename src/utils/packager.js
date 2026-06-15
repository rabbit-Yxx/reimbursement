import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function packageFiles(itemsWithFilenames) {
  try {
    const zip = new JSZip();

    for (const item of itemsWithFilenames) {
      if (item.file && item.newFilename) {
        // item.file is the actual File object from the browser
        zip.file(item.newFilename, item.file);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    
    // Create a filename with today's date
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const defaultName = `报销文件_${dateStr}.zip`;

    saveAs(content, defaultName);
    
    return { success: true };
  } catch (error) {
    console.error('Packaging error:', error);
    return { success: false, error: error.message };
  }
}
