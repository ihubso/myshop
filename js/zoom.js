// Image Zoom Functionality
let currentZoomLevel = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imageOffsetX = 0;
let imageOffsetY = 0;

function zoomImage(imageUrl, imageTitle = '') {
    const modal = document.getElementById('imageZoomModal');
    const zoomedImg = document.getElementById('zoomedImage');
    const titleEl = document.getElementById('zoomedImageTitle');
    
    if (!modal || !zoomedImg) {
        console.error('Image zoom modal elements not found');
        return;
    }
    
    // Reset zoom and position
    currentZoomLevel = 1;
    imageOffsetX = 0;
    imageOffsetY = 0;
    
    // Show loading state
    zoomedImg.classList.add('loading');
    zoomedImg.src = '';
    
    // Set image with error handling
    const img = new Image();
    img.onload = function() {
        zoomedImg.src = imageUrl;
        zoomedImg.classList.remove('loading');
        resetImageTransform();
    };
    img.onerror = function() {
        zoomedImg.src = 'data:/image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f0f0f0"/><text x="100" y="100" text-anchor="middle" dy=".3em" font-family="Arial" font-size="14" fill="%23999">Image not available</text></svg>';
        zoomedImg.classList.remove('loading');
        resetImageTransform();
    };
    img.src = imageUrl;
    
    // Set title
    if (titleEl && imageTitle) {
        titleEl.textContent = imageTitle;
    }
    

    
    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
    
    // Track current modal
    currentModalId = 'imageZoomModal';
    
     openModal('imageZoomModal');
    document.body.style.overflow = 'hidden';
    
    // Add event listeners for dragging
    zoomedImg.addEventListener('mousedown', startDrag);
    zoomedImg.addEventListener('touchstart', startDragTouch);
    
    // Add wheel zoom listener to modal
    modal.addEventListener('wheel', handleWheelZoom, { passive: false });
    
    // Update zoom indicator
    updateZoomIndicator();
}

function closeImageZoom(isFromBackButton = false) {
    const modal = document.getElementById('imageZoomModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
    
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Remove event listeners
    const zoomedImg = document.getElementById('zoomedImage');
    if (zoomedImg) {
        zoomedImg.removeEventListener('mousedown', startDrag);
        zoomedImg.removeEventListener('touchstart', startDragTouch);
    }
    
    // Remove wheel zoom listener
    if (modal) {
        modal.removeEventListener('wheel', handleWheelZoom);
    }
    
    // Reset state
    isDragging = false;
    
    // === UPDATE HISTORY IF NOT FROM BACK BUTTON ===
    if (!isFromBackButton && currentModalId === 'imageZoomModal') {
        window.history.pushState({ modal: null }, '', window.location.href);
        currentModalId = null;
    } else if (isFromBackButton) {
        currentModalId = null;
    }
}

// Zoom controls
function zoomIn() {
    if (currentZoomLevel < 5) {
        currentZoomLevel += 0.25;
        updateImageTransform();
        updateZoomIndicator();
    }
}

function zoomOut() {
    if (currentZoomLevel > 0.25) {
        currentZoomLevel -= 0.25;
        updateImageTransform();
        updateZoomIndicator();
    }
}

function resetZoom() {
    currentZoomLevel = 1;
    imageOffsetX = 0;
    imageOffsetY = 0;
    updateImageTransform();
    updateZoomIndicator();
}

function updateImageTransform() {
    const zoomedImg = document.getElementById('zoomedImage');
    if (zoomedImg) {
        zoomedImg.style.transform = `translate(${imageOffsetX}px, ${imageOffsetY}px) scale(${currentZoomLevel})`;
    }
}

function resetImageTransform() {
    const zoomedImg = document.getElementById('zoomedImage');
    if (zoomedImg) {
        zoomedImg.style.transform = 'translate(0px, 0px) scale(1)';
        zoomedImg.style.transition = 'transform 0.3s ease';
    }
}

function updateZoomIndicator() {
    const indicator = document.getElementById('zoomLevelIndicator');
    if (indicator) {
        const percentage = Math.round(currentZoomLevel * 100);
        indicator.textContent = `${percentage}%`;
        indicator.classList.toggle('hidden', currentZoomLevel === 1);
    }
}

// Drag functionality
function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX - imageOffsetX;
    dragStartY = e.clientY - imageOffsetY;
    
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
}

function startDragTouch(e) {
    if (e.touches.length === 1) {
        e.preventDefault();
        isDragging = true;
        dragStartX = e.touches[0].clientX - imageOffsetX;
        dragStartY = e.touches[0].clientY - imageOffsetY;
        
        document.addEventListener('touchmove', doDragTouch, { passive: false });
        document.addEventListener('touchend', stopDrag);
    } else if (e.touches.length === 2) {
        // Handle pinch zoom for touch devices
        e.preventDefault();
        // You can add pinch zoom logic here if needed
    }
}

function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    imageOffsetX = e.clientX - dragStartX;
    imageOffsetY = e.clientY - dragStartY;
    updateImageTransform();
}

function doDragTouch(e) {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    
    imageOffsetX = e.touches[0].clientX - dragStartX;
    imageOffsetY = e.touches[0].clientY - dragStartY;
    updateImageTransform();
}

function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('touchmove', doDragTouch);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchend', stopDrag);
}

// Download functionality
function downloadZoomedImage() {
    const zoomedImg = document.getElementById('zoomedImage');
    if (!zoomedImg || !zoomedImg.src || zoomedImg.src.startsWith('data:')) {
        alert('Cannot download this image');
        return;
    }
    
    const link = document.createElement('a');
    link.href = zoomedImg.src;
    link.download = `image_${Date.now()}.jpg`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('imageZoomModal');
    if (!modal || modal.classList.contains('hidden')) return;
    
    switch(e.key) {
        case 'Escape':
            closeImageZoom();
            break;
        case '+':
        case '=':
            e.preventDefault();
            zoomIn();
            break;
        case '-':
        case '_':
            e.preventDefault();
            zoomOut();
            break;
        case '0':
            e.preventDefault();
            resetZoom();
            break;
        case 'd':
        case 'D':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                downloadZoomedImage();
            }
            break;
    }
});

// Double click to reset zoom
document.getElementById('zoomedImage')?.addEventListener('dblclick', function(e) {
    e.preventDefault();
    e.stopPropagation();
    resetZoom();
});

// Wheel zoom handler
function handleWheelZoom(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}



function zoomUserPhoto() {
    // 1. Define the fix helper locally to be safe
    const fixPath = (path) => {
        if (!path) return '/image/placeholder.png';
        // Already a full URL (Supabase Storage) - use as-is
        if (path.startsWith('http')) return path;
        // Local asset
        if (path.startsWith('/image/')) return path;
        // Base64 data URL
        if (path.startsWith('data:')) return path;
        // Fallback for any other relative paths
        return path;
    };

    const userPhoto = document.getElementById('modalUserPhoto');
    const managerPhoto = document.getElementById('managerProfilePhoto');
    
    // 2. Determine which photo is actually visible/available
    // If the modal is open, use userPhoto. If we are in the profile settings, use managerPhoto.
    const targetPhoto = (userPhoto && userPhoto.offsetParent !== null) ? userPhoto : managerPhoto;

    if (!targetPhoto || !targetPhoto.src || targetPhoto.src.includes('out%20of%20stock')) {
        console.warn("No valid user photo found to zoom.");
        return; 
    }

    // 3. Clean the path
    // We use .getAttribute('src') to get the raw path before the browser turns it into a full URL
    const rawPath = targetPhoto.getAttribute('src');
    const cleanSrc = fixPath(rawPath);

    // 4. Get the user name for the caption
    const userName = document.getElementById('modalUserFullName')?.textContent || 
                     document.getElementById('modalUserName')?.textContent || 
                     document.getElementById('managerName')?.textContent ||
                     'User';

    // 5. Call your zoom utility
    if (typeof zoomImage === 'function') {
        zoomImage(cleanSrc, `${userName}'s Photo`);
    } else {
        console.error("zoomImage function not found!");
    }
}



// Put this all in a file like modalHelper.js or in your <script> tag

let currentModalId = null;

function showModal(modalId) {
    if (currentModalId) {
        document.getElementById(currentModalId).classList.add('hidden');
    }
    
    window.history.pushState({ modal: modalId }, '', window.location.href);
    document.getElementById(modalId).classList.remove('hidden');
    currentModalId = modalId;
}

function hideModal(modalId, isFromBack = false) {
    document.getElementById(modalId).classList.add('hidden');
    currentModalId = null;
    
    if (!isFromBack) {
        window.history.pushState({ modal: null }, '', window.location.href);
    }
}

function closeCurrentModal() {
    if (currentModalId) {
        hideModal(currentModalId);
    }
}

// Back button handler
