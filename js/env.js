// js/env.js - Environment configuration
// These values are replaced by Vercel at build time or fetched at runtime


// Add this helper function to upload any image
async function uploadToCloudinary(file, options = {}) {
    if (!file) throw new Error('No file provided');

    // 1. Ask the server for a signature
    const sigRes = await fetch(
        `${window.ENV.MYSHOPSUPABASE_URL}/functions/v1/cloudinary-sign`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.ENV.MYSHOPSUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                sessionToken: localStorage.getItem('sessionToken'),
                // Short tag — the server builds the full folder
                folder: options.folderIntent || 'uploads',
            }),
        },
    );

    const sig = await sigRes.json();
    if (!sigRes.ok) {
        throw new Error(sig.error || 'Could not sign upload');
    }

    // 2. Upload with the signature
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sig.apiKey);
    formData.append('timestamp', sig.timestamp);
    formData.append('signature', sig.signature);
    formData.append('folder', sig.folder);
    formData.append('upload_preset', sig.uploadPreset);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
        { method: 'POST', body: formData },
    );

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Upload failed');
    }

    const result = await response.json();
    return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
    };
}
// For uploading multiple product images
async function uploadMultipleImages(files) {
    const uploadPromises = Array.from(files).map(file => uploadToCloudinary(file));
    const results = await Promise.all(uploadPromises);
    return results.map(r => r.url);  // Return array of URLs
}
