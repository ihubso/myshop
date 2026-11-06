// calutor.js - Draggable Keyboard Calculator

class DraggableCalculator {
    constructor() {
        this.display = null;
        this.calculator = null;
        this.calculatorHeader = null;
        this.closeBtn = null;
        this.buttons = null;
        
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // Check if DOM is already loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initcalcultr());
        } else {
            this.initcalcultr();
        }
    }
    
    initcalcultr() {
        this.createCalculatorHTML();
        this.setupElements();
        this.setupEventListeners();
        this.setupGlobalStyles();
    }
    
    createCalculatorHTML() {
        // Prevent creating duplicates
        if (document.querySelector('.calculator')) return;

        const calculatorHTML = `
            <div class="calculator rounded-2xl shadow-2xl overflow-hidden">
                <div class="calculator-header bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                    <span class="text-xs font-medium">Drag here to move</span>
                    <button class="close-btn hover:text-red-300">×</button>
                </div>
                
                <div class="glass-effect p-6">
                    <input type="text" class="display w-full h-16 mb-4 px-4 text-right text-3xl font-semibold rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white border-2 border-gray-700 focus:outline-none focus:border-indigo-500 shadow-inner" id="display" disabled />
                    
                    <div class="grid grid-cols-4 gap-3">
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white font-medium text-lg hover:from-rose-600 hover:to-pink-700 active:scale-95 shadow-lg" data-action="clear">C</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-medium text-lg hover:from-emerald-600 hover:to-teal-700 active:scale-95 shadow-lg" data-action="divide">÷</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-medium text-lg hover:from-emerald-600 hover:to-teal-700 active:scale-95 shadow-lg" data-action="multiply">×</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-medium text-lg hover:from-emerald-600 hover:to-teal-700 active:scale-95 shadow-lg" data-action="subtract">−</button>

                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="7">7</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="8">8</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="9">9</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white font-medium text-lg hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-lg row-span-2" data-action="add">+</button>

                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="4">4</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="5">5</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="6">6</button>

                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="1">1</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="2">2</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="3">3</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white font-medium text-lg hover:from-violet-600 hover:to-purple-700 active:scale-95 shadow-lg row-span-2" data-action="equals">=</button>

                        <button class="col-span-2 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-value="0">0</button>
                        <button class="col-span-1 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white font-medium text-lg hover:from-slate-800 hover:to-slate-900 active:scale-95 shadow-md" data-action="decimal">.</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', calculatorHTML);
    }
    
    setupElements() {
        this.display = document.getElementById('display');
        this.calculator = document.querySelector('.calculator');
        this.calculatorHeader = document.querySelector('.calculator-header');
        this.closeBtn = this.calculatorHeader.querySelector('.close-btn');
        this.buttons = document.querySelectorAll('.calculator button[data-value], .calculator button[data-action]');
    }

    setupGlobalStyles() {
        if(document.getElementById('calc-styles')) return;

        const style = document.createElement('style');
        style.id = 'calc-styles';
        style.textContent = `
            .calculator {
                display: none;
                cursor: move;
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 9999999999999999999999999999999999999999999999; /* High z-index to ensure it shows on top */
                user-select: none;
                backdrop-filter: blur(10px);
                max-width: 90vw;
                width: 320px;
            }

            .calculator.show {
                display: block;
                animation: fadeIn 0.3s ease-out;
            }

            .calculator.dragging {
                opacity: 0.9;
                cursor: grabbing;
            }

            .calculator-header {
                position: relative; /* Fixed from absolute to relative for better layout */
                height: 30px;
                border-radius: 5px 5px 0 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 10px;
                cursor: move;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 20px;
                font-weight: bold;
                cursor: pointer;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
                to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }

            .glass-effect {
                background: rgba(30, 41, 59, 0.85); /* Darker background for visibility */
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
           @media print {
                .calculator {
                    display: none !important;
                }
            }     
        `;
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Apply passive: true to ALL touch listeners
        this.setupPassiveTouchListeners();
        
        // Button click listeners
        this.buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const value = button.getAttribute('data-value');
                const action = button.getAttribute('data-action');
                if (value) this.appendToDisplay(value);
                else if (action) this.handleAction(action);
            }, { passive: true });
        });
        
        // Close button
        this.closeBtn.addEventListener('click', () => this.closeCalculator(), { passive: true });
        
        // Mouse dragging
        this.calculatorHeader.addEventListener('mousedown', (e) => this.startDragging(e), { passive: true });
        document.addEventListener('mousemove', (e) => this.doDragging(e));
        document.addEventListener('mouseup', () => this.stopDragging(), { passive: true });
        
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyboard(e), { passive: true });
    }
    
    setupPassiveTouchListeners() {
        // Fix all touch event listeners with passive: true
        this.calculatorHeader.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            e.preventDefault();
            this.startDraggingTouch(e);
        }, { passive: false }); // Only touchstart needs non-passive for preventDefault
        
        document.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;
            e.preventDefault();
            this.doDraggingTouch(e);
        }, { passive: false }); // Only touchmove needs non-passive for preventDefault
        
        document.addEventListener('touchend', () => {
            this.stopDragging();
        }, { passive: true });
        
        // Make all other touch listeners passive
        this.buttons.forEach(button => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const value = button.getAttribute('data-value');
                const action = button.getAttribute('data-action');
                if (value) this.appendToDisplay(value);
                else if (action) this.handleAction(action);
            }, { passive: false });
        });
    }
    
    // Logic Methods
    appendToDisplay(value) {
        this.display.value += value;
        this.display.scrollLeft = this.display.scrollWidth;
    }
    
    clearDisplay() {
        this.display.value = '';
    }
    
    calculate() {
        try {
            let expression = this.display.value.replace(/×/g, '*').replace(/÷/g, '/');
            if (expression === '') return;
            // Safer eval alternative using Function
            this.display.value = new Function('return ' + expression)();
        } catch (error) {
            this.display.value = 'Error';
            setTimeout(() => this.clearDisplay(), 1500);
        }
    }
    
    closeCalculator() {
        this.calculator.classList.remove('show');
        this.clearDisplay();
    }
    
    handleAction(action) {
        switch(action) {
            case 'clear': this.clearDisplay(); break;
            case 'equals': this.calculate(); break;
            case 'add': this.appendToDisplay('+'); break;
            case 'subtract': this.appendToDisplay('-'); break;
            case 'multiply': this.appendToDisplay('×'); break;
            case 'divide': this.appendToDisplay('÷'); break;
            case 'decimal': this.appendToDisplay('.'); break;
        }
    }
    
    // Dragging Logic
    startDragging(e) {
        e.preventDefault();
        this.isDragging = true;
        this.calculator.classList.add('dragging');
        const rect = this.calculator.getBoundingClientRect();
        this.dragOffsetX = e.clientX - rect.left;
        this.dragOffsetY = e.clientY - rect.top;
    }
    
    doDragging(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        const x = e.clientX - this.dragOffsetX;
        const y = e.clientY - this.dragOffsetY;
        this.calculator.style.left = `${x}px`;
        this.calculator.style.top = `${y}px`;
        this.calculator.style.transform = 'none';
    }
    
    stopDragging() {
        this.isDragging = false;
        if(this.calculator) this.calculator.classList.remove('dragging');
    }

    startDraggingTouch(e) {
        if (e.touches.length !== 1) return;
        this.isDragging = true;
        this.calculator.classList.add('dragging');
        const touch = e.touches[0];
        const rect = this.calculator.getBoundingClientRect();
        this.dragOffsetX = touch.clientX - rect.left;
        this.dragOffsetY = touch.clientY - rect.top;
    }
    
    doDraggingTouch(e) {
        if (!this.isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        const x = touch.clientX - this.dragOffsetX;
        const y = touch.clientY - this.dragOffsetY;
        this.calculator.style.left = `${x}px`;
        this.calculator.style.top = `${y}px`;
        this.calculator.style.transform = 'none';
    }
    
    handleKeyboard(e) {
        // Only react if calculator is shown
        if (!this.calculator || !this.calculator.classList.contains('show')) return;

        const key = e.key;
        if (/^[0-9]$/.test(key)) this.appendToDisplay(key);
        else if (key === '+') this.appendToDisplay('+');
        else if (key === '-') this.appendToDisplay('-');
        else if (key === '*') this.appendToDisplay('×');
        else if (key === '/') this.appendToDisplay('÷');
        else if (key === '.') this.appendToDisplay('.');
        else if (key === 'Enter') this.calculate();
        else if (key === 'Escape') this.closeCalculator();
        else if (key === 'Backspace') this.display.value = this.display.value.slice(0, -1);
    }

    show() {
        if (this.calculator) {
            this.calculator.classList.add('show');
            // Reset position to center if it's off screen
            const rect = this.calculator.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                 this.calculator.style.top = '50%';
                 this.calculator.style.left = '50%';
                 this.calculator.style.transform = 'translate(-50%, -50%)';
            }
        }
    }
}

// Add this function to fix ALL touch events globally
function applyPassiveTouchListeners() {
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        // Apply passive: true to ALL touch events by default
        if (type === 'touchstart' || type === 'touchmove' || type === 'touchend') {
            if (typeof options === 'boolean') {
                options = { capture: options, passive: true };
            } else if (typeof options === 'object') {
                if (!options.hasOwnProperty('passive')) {
                    options.passive = true;
                }
            } else {
                options = { passive: true };
            }
        }
        return originalAddEventListener.call(this, type, listener, options);
    };
}

// Global initialization
window.initCalculator = function() {
    // Apply passive touch listeners globally
    applyPassiveTouchListeners();
    
    window.calculator = new DraggableCalculator();

    // Attach to buttons reliably with passive listeners
    const attachListeners = () => {
        const elements = [
            'salesTableBody',
            'stock-history-section', 
            'expensesSection',
            'creditSalesSection',
            'currentStockSection'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('dblclick', () => {
                    if (window.calculator) window.calculator.show();
                }, { passive: true });
            }
        });
    };

    // Run now or when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachListeners, { passive: true });
    } else {
        attachListeners();
    }
};

