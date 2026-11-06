// buttonLoading.js - Simple button loading state utility

class ButtonLoading {
    constructor() {
        this.states = new WeakMap();
        this.initStyles();
    }

    /**
     * Initialize the spinner animation styles
     */
    initStyles() {
        if (!document.querySelector('#button-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'button-loading-styles';
            style.textContent = `
                @keyframes button-loading-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .button-loading-spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #3498db;
                    border-radius: 50%;
                    animation: button-loading-spin 1s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Show loading state on a button
     * @param {HTMLElement} button - Button element
     * @param {string} loadingText - Text to show while loading
     * @returns {void}
     */
    show(button, loadingText = 'Loading...') {
        if (!button) {
            console.warn('Button element not found');
            return;
        }

        // Store original state
        this.states.set(button, {
            text: button.textContent,
            html: button.innerHTML,
            disabled: button.disabled,
            width: button.offsetWidth
        });

        // Set loading state
        button.disabled = true;
        button.style.minWidth = `${button.offsetWidth}px`;
        button.innerHTML = `
            <span class="button-loading-spinner"></span>
            ${loadingText}
        `;
    }

    /**
     * Hide loading state and restore button
     * @param {HTMLElement} button - Button element
     * @returns {void}
     */
    hide(button) {
        if (!button) {
            console.warn('Button element not found');
            return;
        }

        const originalState = this.states.get(button);

        if (originalState) {
            button.disabled = originalState.disabled;
            button.innerHTML = originalState.html;
            button.style.minWidth = '';
            this.states.delete(button);
        } else {
            // Fallback: just enable the button
            button.disabled = false;
            button.textContent = 'Submit';
        }
    }

    /**
     * Execute async function with button loading state
     * @param {HTMLElement} button - Button element
     * @param {Function} asyncFunction - Async function to execute
     * @param {Object} options - Options for loading
     * @returns {Promise<any>} - Result of async function
     */
    async execute(button, asyncFunction, options = {}) {
        const {
            loadingText = 'Loading...',
            minLoadingTime = 0,
            errorText = 'Error! Try again',
            showError = false
        } = options;

        this.show(button, loadingText);
        const startTime = Date.now();

        try {
            const result = await asyncFunction();
            
            // Ensure minimum loading time for better UX
            const elapsed = Date.now() - startTime;
            if (minLoadingTime > elapsed) {
                await new Promise(resolve => 
                    setTimeout(resolve, minLoadingTime - elapsed)
                );
            }
            
            return result;
            
        } catch (error) {
            console.error('Button loading error:', error);
            
            if (showError) {
                this.show(button, errorText);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            throw error;
            
        } finally {
            this.hide(button);
        }
    }
}

// Create a singleton instance for easy use
const buttonLoader = new ButtonLoading();

// Export functions for direct use
export const showButtonLoading = (button, text) => buttonLoader.show(button, text);
export const hideButtonLoading = (button) => buttonLoader.hide(button);
export const withButtonLoading = (button, asyncFunc, options) => 
    buttonLoader.execute(button, asyncFunc, options);

export default buttonLoader;




document.getElementById('myConnectBtn').addEventListener('click', () => {
  window.showDeviceNudgeBanner();
});