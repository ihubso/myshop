let currentStep = 0;
let isTourCompleted = localStorage.getItem('tourCompleted') === 'true';

function startTour() {
    if (isTourCompleted) return;
    
    const tour = document.getElementById('onboardingTour');
    tour.classList.remove('hidden');
    const messageModal = document.getElementById('messageModal');
    if (messageModal) {
        messageModal.classList.add('hidden');
    }
    
    showStep(currentStep);
}
const healthBtn = document.getElementById('healthBtn');
if (healthBtn) {
    healthBtn.addEventListener('click', startTour);
}

function showStep(stepIndex) {
    const step = tourSteps[stepIndex];
    if (!step) return;
    
    // Update title and description with translation
    const tourTitle = document.getElementById('tourTitle');
    const tourDescription = document.getElementById('tourDescription');
    
    if (tourTitle) {
        tourTitle.textContent = translate(step.title);
    }
    if (tourDescription) {
        tourDescription.textContent = translate(step.description);
    }
    
    // Update progress dots
    updateProgressDots(stepIndex);
    
    // Position highlight and tooltip
    highlightElement(step.target, step.position);
    
    // Update buttons
    updateButtons(stepIndex);
}

function highlightElement(selector, position = 'bottom') {
    // First, remove active class from all previous elements
    document.querySelectorAll('.tour-target-active').forEach(el => {
        el.classList.remove('tour-target-active');
    });
    
    const target = document.querySelector(selector);
    const highlight = document.getElementById('tourHighlight');
    const tooltip = document.getElementById('tourTooltip');
    
    if (!target) {
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translate(-50%, -50%)';
        highlight.style.display = 'none';
        return;
    }

    // Add active class to the current target
    target.classList.add('tour-target-active');
    
    highlight.style.display = 'block';
    const rect = target.getBoundingClientRect();
    const padding = 10;
    const offset = 15;

    // Position the Highlight Box
    highlight.style.width = `${rect.width + (padding * 2)}px`;
    highlight.style.height = `${rect.height + (padding * 2)}px`;
    highlight.style.left = `${rect.left - padding}px`;
    highlight.style.top = `${rect.top - padding}px`;

    // Position the Tooltip
    let tooltipTop, tooltipLeft;
    tooltip.style.transform = 'none';

    switch(position) {
        case 'top':
            tooltipTop = rect.top - tooltip.offsetHeight - offset;
            tooltipLeft = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
            break;
        case 'left':
            tooltipTop = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
            tooltipLeft = rect.left - tooltip.offsetWidth - offset;
            break;
        case 'right':
            tooltipTop = rect.top + (rect.height / 2) - (tooltip.offsetHeight / 2);
            tooltipLeft = rect.right + offset;
            break;
        case 'bottom':
        default:
            tooltipTop = rect.bottom + offset;
            tooltipLeft = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);
            break;
    }

    // Boundary Check
    const margin = 10;
    if (tooltipLeft < margin) tooltipLeft = margin;
    if (tooltipLeft + tooltip.offsetWidth > window.innerWidth) {
        tooltipLeft = window.innerWidth - tooltip.offsetWidth - margin;
    }
    if (tooltipTop < margin) tooltipTop = margin;
    if (tooltipTop + tooltip.offsetHeight > window.innerHeight) {
        tooltipTop = window.innerHeight - tooltip.offsetHeight - margin;
    }

    tooltip.style.top = `${tooltipTop}px`;
    tooltip.style.left = `${tooltipLeft}px`;

    // Scroll the element into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


function updateProgressDots(currentIndex) {
    const progressContainer = document.getElementById('tourProgress');
    if (!progressContainer) return;
    
    progressContainer.innerHTML = '';
    
    tourSteps.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `w-3 h-3 rounded-full ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'}`;
        progressContainer.appendChild(dot);
    });
}

function updateButtons(stepIndex) {
    const prevBtn = document.getElementById('tourPrevBtn');
    const nextBtn = document.getElementById('tourNextBtn');
    const skipBtn = document.getElementById('tourSkipBtn');
    
    if (!prevBtn || !nextBtn || !skipBtn) return;
    
    prevBtn.classList.toggle('hidden', stepIndex === 0);
    
    // Apply translations to buttons
    prevBtn.textContent = translate("tour_prev_btn");
    skipBtn.textContent = translate("tour_skip_btn");
    
    if (stepIndex === tourSteps.length - 1) {
        nextBtn.textContent = translate("tour_finish_btn");
        nextBtn.onclick = finishTour;
    } else {
        nextBtn.textContent = translate("tour_next_btn");
        nextBtn.onclick = () => {
            currentStep++;
            showStep(currentStep);
        };
    }
    
    prevBtn.onclick = () => {
        if (currentStep > 0) {
            currentStep--;
            showStep(currentStep);
        }
    };
    
    skipBtn.onclick = finishTour;
}

function finishTour() {
    // Remove active class from all elements
    document.querySelectorAll('.tour-target-active').forEach(el => {
        el.classList.remove('tour-target-active');
    });
    
    localStorage.setItem('tourCompleted', 'true');
    document.getElementById('onboardingTour').classList.add('hidden');
    
    // Show completion message with translation
    const message = translate("tour_complete_message") || '🎉 Onboarding complete! You can now explore the app fully.';
    showMessageModal(message);
    if (window._wnModal) {
        // Adding a 1.5-second delay so it appears nicely after the completion message
        setTimeout(() => {
            window._wnModal.showIfNew();
        }, 1500); 
    }
}


// Updated tour steps with translation keys
// Updated tour steps with translation keys only
const tourSteps = [
    // --- PART 1: DASHBOARD & BASICS ---
    {
        target: '#homeOverlay',
        title: 'tour_step0_title',
        description: 'tour_step0_desc',
        position: 'center'
    },
    {
        target: '#homeBusinessLogo',
        title: 'tour_step1_title',
        description: 'tour_step1_desc',
        position: 'bottom'
    },
    {
        target: '#notifBellBtn',
        title: 'tour_step2_title',
        description: 'tour_step2_desc',
        position: 'left'
    },
    {
        target: '#openReminderListBtn',
        title: 'tour_step3_title',
        description: 'tour_step3_desc',
        position: 'right'
    },
    
    // --- PART 2: SIDEBAR NAVIGATION TO STOCK ---
    {
        target: '.nav-link[data-nav-item="3"]',
        title: 'tour_step4_title',
        description: 'tour_step4_desc',
        position: 'right'
    },
    
    // --- STOCK MANAGEMENT SECTION ---
    {
        target: '#stockOptionsModal',
        title: 'tour_step5_title',
        description: 'tour_step5_desc',
        position: 'center'
    },
    {
        target: '#stockOptionsModal .modal-content',
        title: 'tour_step6_title',
        description: 'tour_step6_desc',
        position: 'center'
    },
    
    // --- STOCK: ADD ITEM ---
    {
        target: '#addOptionBtn',
        title: 'tour_step7_title',
        description: 'tour_step7_desc',
        position: 'bottom'
    },
    {
        target: '#addItemSection',
        title: 'tour_step8_title',
        description: 'tour_step8_desc',
        position: 'top'
    },
    {
        target: '#productName',
        title: 'tour_step9_title',
        description: 'tour_step9_desc',
        position: 'bottom'
    },
    {
        target: '#categoryInput',
        title: 'tour_step10_title',
        description: 'tour_step10_desc',
        position: 'bottom'
    },
    {
        target: '#quantity',
        title: 'tour_step11_title',
        description: 'tour_step11_desc',
        position: 'bottom'
    },
    {
        target: '#price',
        title: 'tour_step12_title',
        description: 'tour_step12_desc',
        position: 'bottom'
    },
    {
        target: '#costPrice',
        title: 'tour_step13_title',
        description: 'tour_step13_desc',
        position: 'bottom'
    },
    {
        target: '#itemImage',
        title: 'tour_step14_title',
        description: 'tour_step14_desc',
        position: 'top'
    },
    {
        target: '#addItemBtn',
        title: 'tour_step15_title',
        description: 'tour_step15_desc',
        position: 'top'
    },
    {
        target: '#addItemSection .back-to-options-btn',
        title: 'tour_step16_title',
        description: 'tour_step16_desc',
        position: 'bottom'
    },

    // --- STOCK: CURRENT STOCK ---
    {
        target: '#currentStockOptionBtn',
        title: 'tour_step17_title',
        description: 'tour_step17_desc',
        position: 'bottom'
    },
    {
        target: '#currentStockSection',
        title: 'tour_step18_title',
        description: 'tour_step18_desc',
        position: 'top'
    },
    {
        target: '#searchItems',
        title: 'tour_step19_title',
        description: 'tour_step19_desc',
        position: 'bottom'
    },
    {
        target: '#stockTypeFilter',
        title: 'tour_step20_title',
        description: 'tour_step20_desc',
        position: 'bottom'
    },
    {
        target: '#printCurrentStockBtn',
        title: 'tour_step21_title',
        description: 'tour_step21_desc',
        position: 'left'
    },
    {
        target: '#stockActionBtn',
        title: 'tour_step22_title',
        description: 'tour_step22_desc',
        position: 'right'
    },
    {
        target: '#editItemDetailsBtn',
        title: 'tour_step23_title',
        description: 'tour_step23_desc',
        position: 'bottom'
    },
    {
        target: '#makeAdBtn',
        title: 'tour_step24_title',
        description: 'tour_step24_desc',
        position: 'bottom'
    },
    {
        target: '#currentStockSection .back-to-options-btn',
        title: 'tour_step25_title',
        description: 'tour_step25_desc',
        position: 'bottom'
    },

    // --- STOCK: HISTORY & ANALYTICS ---
    {
        target: '#historyOptionBtn',
        title: 'tour_step26_title',
        description: 'tour_step26_desc',
        position: 'bottom'
    },
    {
        target: '#stockHistoryOptionBtn',
        title: 'tour_step27_title',
        description: 'tour_step27_desc',
        position: 'bottom'
    },
    {
        target: '#stock-history-section',
        title: 'tour_step28_title',
        description: 'tour_step28_desc',
        position: 'center'
    },
    {
        target: '#printStockHistoryBtn',
        title: 'tour_step29_title',
        description: 'tour_step29_desc',
        position: 'bottom'
    },
    {
        target: '#exportStockExcelBtn',
        title: 'tour_step30_title',
        description: 'tour_step30_desc',
        position: 'bottom'
    },
    {
        target: '#profitLossOptionBtn',
        title: 'tour_step31_title',
        description: 'tour_step31_desc',
        position: 'bottom'
    },
    {
        target: '#profitLossSection',
        title: 'tour_step32_title',
        description: 'tour_step32_desc',
        position: 'top'
    },
    {
        target: '#totalRevenue',
        title: 'tour_step33_title',
        description: 'tour_step33_desc',
        position: 'bottom'
    },
    {
        target: '#totalCogs',
        title: 'tour_step34_title',
        description: 'tour_step34_desc',
        position: 'bottom'
    },
    {
        target: '#netProfitLoss',
        title: 'tour_step35_title',
        description: 'tour_step35_desc',
        position: 'bottom'
    },
    {
        target: '#yearSwitcher',
        title: 'tour_step36_title',
        description: 'tour_step36_desc',
        position: 'bottom'
    },
    {
        target: '.back-to-options-btn',
        title: 'tour_step37_title',
        description: 'tour_step37_desc',
        position: 'bottom'
    },

    // --- STOCK: EXIT ---
    {
        target: '#stockOptionsModal .modal-close-btn',
        title: 'tour_step38_title',
        description: 'tour_step38_desc',
        position: 'left'
    },

    // --- PART 3: SIDEBAR NAVIGATION TO SALES ---
    {
        target: '.nav-link[data-nav-item="2"]',
        title: 'tour_step39_title',
        description: 'tour_step39_desc',
        position: 'right'
    },
    {
        target: '#salesOptionsModal',
        title: 'tour_step40_title',
        description: 'tour_step40_desc',
        position: 'center'
    },
    {
        target: '#salesOptionsModal .modal-content',
        title: 'tour_step41_title',
        description: 'tour_step41_desc',
        position: 'center'
    },

    // --- SALES: RECORD SALE ---
    {
        target: '#recordSaleOptionBtn',
        title: 'tour_step42_title',
        description: 'tour_step42_desc',
        position: 'bottom'
    },
    {
        target: '#saleProductName',
        title: 'tour_step43_title',
        description: 'tour_step43_desc',
        position: 'bottom'
    },
    {
        target: '#saleQuantity',
        title: 'tour_step44_title',
        description: 'tour_step44_desc',
        position: 'bottom'
    },
    {
        target: '#salePrice',
        title: 'tour_step45_title',
        description: 'tour_step45_desc',
        position: 'bottom'
    },
    {
        target: '#saleDate',
        title: 'tour_step46_title',
        description: 'tour_step46_desc',
        position: 'top'
    },
    {
        target: '#saleCustomerName23',
        title: 'tour_step47_title',
        description: 'tour_step47_desc',
        position: 'top'
    },
    {
        target: '#recordSaleBtn',
        title: 'tour_step48_title',
        description: 'tour_step48_desc',
        position: 'top'
    },
    {
        target: '#addExpenseBtn',
        title: 'tour_step49_title',
        description: 'tour_step49_desc',
        position: 'top'
    },
    {
        target: '#recordNewSaleSection .back-to-sales-options-btn',
        title: 'tour_step50_title',
        description: 'tour_step50_desc',
        position: 'bottom'
    },

    // --- SALES: HISTORY & CREDIT ---
    {
        target: '#salesHistoryOptionBtn',
        title: 'tour_step51_title',
        description: 'tour_step51_desc',
        position: 'bottom'
    },
    {
        target: '#sales-history-section',
        title: 'tour_step52_title',
        description: 'tour_step52_desc',
        position: 'top'
    },
    {
        target: '#creditBookOptionBtn',
        title: 'tour_step53_title',
        description: 'tour_step53_desc',
        position: 'top'
    },
    {
        target: '#expensesOptionBtn',
        title: 'tour_step54_title',
        description: 'tour_step54_desc',
        position: 'top'
    },
    {
        target: '#createNewReceiptBtn',
        title: 'tour_step55_title',
        description: 'tour_step55_desc',
        position: 'top'
    },
    {
        target: '#sales-history-section .back-to-sales-options-btn',
        title: 'tour_step56_title',
        description: 'tour_step56_desc',
        position: 'bottom'
    },

    // --- SALES: EXIT ---
    {
        target: '#salesOptionsModal .modal-close-btn',
        title: 'tour_step57_title',
        description: 'tour_step57_desc',
        position: 'left'
    },

    // --- PART 4: REMINDERS & NOTIFICATIONS ---
    {
        target: '#openReminderListBtn',
        title: 'tour_step58_title',
        description: 'tour_step58_desc',
        position: 'right'
    },
    {
        target: '#notifBellBtn',
        title: 'tour_step59_title',
        description: 'tour_step59_desc',
        position: 'left'
    },

    // --- PART 5: USER PROFILE ---
    {
        target: '#sidebar-user-section',
        title: 'tour_step60_title',
        description: 'tour_step60_desc',
        position: 'right'
    },
    
    // --- PART 6: CONCLUSION ---
    {
        target: '#sidebar-logout-btn',
        title: 'tour_step61_title',
        description: 'tour_step61_desc',
        position: 'right'
    },
    {
        target: 'body',
        title: 'tour_step62_title',
        description: 'tour_step62_desc',
        position: 'center'
    }
];