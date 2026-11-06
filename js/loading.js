/* =========================
   GLOBAL STATE
========================= */
let isCancelled = false;
let loadingInterval = null;
let abortController = null;

const loadingOverlay = document.getElementById('loadingOverlay');

function bringloadingOverlayToFront() {
  if (loadingOverlay && document.body.lastElementChild !==loadingOverlay) {
    document.body.appendChild(loadingOverlay);
  }
}



/* =========================
   SHOW LOADING
========================= */
async function showLoading(message = translate('loading')) {
    try {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            console.error('Loading overlay element not found');
            return;
        }

        // Reset state for new operation
        isCancelled = false;
        
        // Clear any existing abort controller
        if (abortController) {
            try {
                abortController.abort();
            } catch (e) {
                // Ignore abort errors
            }
            abortController = null;
        }

        // Show overlay
        overlay.classList.remove('hidden');
         bringloadingOverlayToFront();
          document.body.appendChild(overlay);
        
        // Center the overlay if not already
        if (!overlay.style.display || overlay.style.display === 'none') {
            overlay.style.display = 'flex';
        }

        // Update message if provided
        const messageEl = overlay.querySelector('.loading-message');
        if (messageEl && message) {
            messageEl.textContent = message;
        }

        // Show cancel button if exists
        const cancelBtn = document.getElementById('cancelLoadingBtn');
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
            cancelBtn.disabled = false;
            cancelBtn.textContent = translate('cancel') || 'Cancel';
        }

        // Add Escape key listener
        document.addEventListener('keydown', handleEscapeKey, { once: false });

        console.log('Loading started:', message);

    } catch (error) {
        console.error('Error in showLoading:', error);
    }
}

/* =========================
   HIDE LOADING (UI ONLY)
========================= */
function hideLoading() {
    try {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;

        // Add fade-out animation
        overlay.classList.add('hidden');
        
        // Optional: Remove display after animation
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300); // Match this with CSS transition duration

        // Clear any intervals
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }

        // Reset cancel button
        const cancelBtn = document.getElementById('cancelLoadingBtn');
        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.textContent = translate('cancel') || 'Cancel';
        }

        // Remove event listeners
        document.removeEventListener('keydown', handleEscapeKey);
        
        // Reset abort controller
        if (abortController) {
            abortController = null;
        }

        console.log('Loading hidden');

    } catch (error) {
        console.error('Error in hideLoading:', error);
    }
}

/* =========================
   HANDLE ESCAPE KEY
========================= */
function handleEscapeKey(event) {
    // Check for Escape key (keyCode 27 or key 'Escape')
    if (event.key === 'Escape' || event.keyCode === 27) {
        event.preventDefault(); // Prevent default Escape behavior
        event.stopPropagation(); // Stop event bubbling
        
        // Only cancel if loading is visible
        const overlay = document.getElementById('loadingOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            cancelLoading();
        }
    }
}

/* =========================
   CANCEL LOADING (UI + TASK)
========================= */
function cancelLoading() {
    try {
        // Don't do anything if already cancelled
        if (isCancelled) {
            console.log('Already cancelled, ignoring');
            return;
        }
        
        console.warn('Task cancelled by user');
        isCancelled = true;

        // Show visual feedback immediately
        const cancelBtn = document.getElementById('cancelLoadingBtn');
        if (cancelBtn) {
            const originalText = cancelBtn.textContent;
            cancelBtn.textContent = translate('cancelling') || 'Cancelling...';
            cancelBtn.disabled = true;
            
            // Reset button after delay
            setTimeout(() => {
                if (cancelBtn) {
                    cancelBtn.textContent = originalText;
                    cancelBtn.disabled = false;
                    cancelBtn.style.display = 'none';
                }
            }, 1000);
        }

        // Abort any ongoing fetch requests
        if (abortController) {
            try {
                abortController.abort();
                console.log('Abort controller triggered');
            } catch (error) {
                console.warn('Error aborting controller:', error);
            }
            abortController = null;
        }

        // Hide loading with slight delay for visual feedback
        setTimeout(() => {
            hideLoading();
        }, 300);

        // Dispatch custom event for other components to handle
        const cancelEvent = new CustomEvent('loadingCancelled', {
            detail: { timestamp: Date.now() }
        });
        document.dispatchEvent(cancelEvent);

    } catch (error) {
        console.error('Error in cancelLoading:', error);
        // Still hide loading even if there's an error
        hideLoading();
    }
}

/* =========================
   CREATE ABORT CONTROLLER FOR FETCH
========================= */
function createAbortController() {
    // Clean up existing controller
    if (abortController) {
        try {
            abortController.abort();
        } catch (e) {
            // Ignore errors
        }
    }
    
    abortController = new AbortController();
    return abortController.signal;
}

/* =========================
   FETCH WITH CANCELLATION SUPPORT
========================= */
async function fetchWithCancel(url, options = {}) {
    if (isCancelled) {
        throw new Error('Operation cancelled');
    }

    const signal = createAbortController();
    
    const fetchOptions = {
        ...options,
        signal
    };

    try {
        const response = await fetch(url, fetchOptions);
        
        // Check if cancelled during fetch
        if (isCancelled) {
            throw new Error('Operation cancelled');
        }
        
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request was cancelled');
        }
        throw error;
    }
}

/* =========================
   PROGRESS LOADING
========================= */
function showProgressLoading(message, duration = 0) {
    showLoading(message);
    
    if (duration > 0) {
        // Auto-hide after duration
        setTimeout(() => {
            if (!isCancelled) {
                hideLoading();
            }
        }, duration);
    }
    
    // Optional: Progress bar animation
    const progressBar = document.getElementById('loadingProgress');
    if (progressBar) {
        let progress = 0;
        loadingInterval = setInterval(() => {
            if (isCancelled) {
                clearInterval(loadingInterval);
                loadingInterval = null;
                return;
            }
            
            progress += 1;
            progressBar.style.width = `${progress}%`;
            
            if (progress >= 100) {
                clearInterval(loadingInterval);
                loadingInterval = null;
            }
        }, (duration || 10000) / 100);
    }
}

/* =========================
   BUTTON BINDING
========================= */

/* =========================
   RESET CANCELLATION STATE
========================= */
function resetCancellation() {
    isCancelled = false;
    if (abortController) {
        abortController = null;
    }
}

/* =========================
   CHECK IF CANCELLED
========================= */
function checkCancelled() {
    if (isCancelled) {
        throw new Error('Operation cancelled by user');
    }
    return false;
}







